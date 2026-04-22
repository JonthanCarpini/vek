// Ações sobre pedidos iFood (chamadas saindo do nosso sistema para o iFood).
// Cada ação atualiza o registro local após sucesso na API.

import { prisma } from '@/lib/prisma';
import { ifoodFetch } from './client';

const ORDER_PATH = '/order/v1.0/orders';

async function loadIfoodOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } }) as any;
  if (!order) throw new Error('Pedido não encontrado');
  if (!order.ifoodOrderId) throw new Error('Pedido não pertence ao canal iFood');
  return order;
}

/**
 * Confirma o recebimento do pedido no iFood (equivale a "aceitar").
 * Status iFood: PLACED -> CONFIRMED.
 */
export async function confirmIfoodOrder(orderId: string) {
  const order = await loadIfoodOrder(orderId);
  await ifoodFetch(`${ORDER_PATH}/${order.ifoodOrderId}/confirm`, { method: 'POST' });
  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
      ifoodStatus: 'CONFIRMED',
    } as any,
  });
}

/**
 * Informa ao iFood que a preparação começou.
 * Status iFood: CONFIRMED -> PREPARATION_STARTED.
 */
export async function startIfoodPreparation(orderId: string) {
  const order = await loadIfoodOrder(orderId);
  await ifoodFetch(`${ORDER_PATH}/${order.ifoodOrderId}/startPreparation`, { method: 'POST' });
  return prisma.order.update({
    where: { id: order.id },
    data: { status: 'preparing', ifoodStatus: 'PREPARATION_STARTED' } as any,
  });
}

/**
 * Marca o pedido como pronto para retirada (usado em TAKEOUT/INDOOR).
 * Status iFood: PREPARATION_STARTED -> READY_TO_PICKUP.
 */
export async function readyIfoodOrder(orderId: string) {
  const order = await loadIfoodOrder(orderId);
  await ifoodFetch(`${ORDER_PATH}/${order.ifoodOrderId}/readyToPickup`, { method: 'POST' });
  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'ready',
      readyAt: new Date(),
      ifoodStatus: 'READY_TO_PICKUP',
    } as any,
  });
}

/**
 * Informa ao iFood que o pedido saiu para entrega (DELIVERY).
 * Status iFood: READY_TO_PICKUP -> DISPATCHED.
 */
export async function dispatchIfoodOrder(orderId: string) {
  const order = await loadIfoodOrder(orderId);
  await ifoodFetch(`${ORDER_PATH}/${order.ifoodOrderId}/dispatch`, { method: 'POST' });
  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
      ifoodStatus: 'DISPATCHED',
    } as any,
  });
}

/**
 * Solicita cancelamento ao iFood.
 * @param reason descrição do motivo (livre)
 * @param cancellationCode código oficial do iFood (ex: "501" = Loja sem item, etc.).
 */
export async function requestIfoodCancellation(
  orderId: string,
  reason: string,
  cancellationCode: string,
) {
  const order = await loadIfoodOrder(orderId);
  await ifoodFetch(`${ORDER_PATH}/${order.ifoodOrderId}/requestCancellation`, {
    method: 'POST',
    body: JSON.stringify({ reason, cancellationCode }),
  });
  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'cancelled',
      ifoodStatus: 'CANCELLATION_REQUESTED',
      notes: `${order.notes ? order.notes + '\n' : ''}[Cancelamento solicitado: ${reason}]`,
    } as any,
  });
}

/**
 * Lista códigos de cancelamento válidos para um pedido específico.
 * Endpoint: GET /order/v1.0/orders/{id}/cancellationReasons
 */
export async function listIfoodCancellationReasons(orderId: string) {
  const order = await loadIfoodOrder(orderId);
  return ifoodFetch(`${ORDER_PATH}/${order.ifoodOrderId}/cancellationReasons`);
}

/**
 * Mapper: dado o novo status interno (vindo do KDS), dispara a ação correspondente no iFood.
 * Chamado pelo fluxo da cozinha para refletir mudanças no iFood automaticamente.
 */
export async function syncStatusToIfood(orderId: string, newStatus: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } }) as any;
  if (!order?.ifoodOrderId) return; // não é pedido iFood
  if (order.channel !== 'ifood') return;

  try {
    switch (newStatus) {
      case 'accepted':
        if (order.ifoodStatus !== 'CONFIRMED') {
          await confirmIfoodOrder(orderId);
        }
        break;
      case 'preparing':
        if (!['PREPARATION_STARTED'].includes(order.ifoodStatus || '')) {
          await startIfoodPreparation(orderId);
        }
        break;
      case 'ready':
        if (!['READY_TO_PICKUP'].includes(order.ifoodStatus || '')) {
          await readyIfoodOrder(orderId);
        }
        break;
      case 'delivered':
        // só chama dispatch se for DELIVERY; pickup/indoor já se resolvem no READY
        if (order.ifoodStatus === 'READY_TO_PICKUP') {
          await dispatchIfoodOrder(orderId);
        }
        break;
    }
  } catch (err: any) {
    console.error(`[iFood] Falha ao sincronizar status (${newStatus}) do pedido ${orderId}:`, err?.message || err);
  }
}
