// Mapper e ações sobre pedidos iFood.
// Quando um evento PLC chega, buscamos os detalhes e criamos um Order local
// vinculado a uma "mesa virtual" da unidade (criada sob demanda).

import { prisma } from '@/lib/prisma';
import { ifoodFetch } from './client';
import type { IfoodOrderDTO } from './types';
import { emitToKitchen, emitToWaiters, emitToDashboard, SocketEvents } from '@/lib/socket';
import { serializeOrder } from '@/lib/orders';

const VIRTUAL_TABLE_NUMBER = 9999; // Número fixo reservado para pedidos iFood

/**
 * Garante que a unidade tenha uma mesa virtual para pedidos iFood.
 * Usa número 9999 reservado. Cria caso não exista.
 */
export async function ensureIfoodVirtualTable(unitId: string) {
  const existing = await (prisma as any).tableEntity.findFirst({
    where: { unitId, virtual: true, number: VIRTUAL_TABLE_NUMBER },
  });
  if (existing) return existing;

  return (prisma as any).tableEntity.create({
    data: {
      unitId,
      number: VIRTUAL_TABLE_NUMBER,
      label: 'iFood Delivery',
      qrToken: `ifood-${unitId}`,
      status: 'free',
      capacity: 0,
      virtual: true,
    },
  });
}

/**
 * Busca um pedido iFood pela API (endpoint: /order/v1.0/orders/{id}).
 */
export async function fetchIfoodOrder(orderId: string): Promise<IfoodOrderDTO> {
  return ifoodFetch<IfoodOrderDTO>(`/order/v1.0/orders/${orderId}`);
}

/**
 * Cria (ou atualiza) o pedido local a partir do DTO do iFood.
 * Se já existir um Order com o mesmo ifoodOrderId, atualiza status.
 */
export async function upsertOrderFromIfood(unitId: string, dto: IfoodOrderDTO) {
  // Já existe?
  const existing = await prisma.order.findFirst({
    where: { ifoodOrderId: dto.id, unitId },
    include: { items: true, table: true },
  });

  if (existing) {
    // Atualiza apenas status textual do iFood, sem duplicar
    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: { ifoodStatus: dto.status || existing.ifoodStatus },
      include: { items: true, table: true },
    });
    return { order: updated, created: false };
  }

  // Garantir mesa virtual + session
  const vtable = await ensureIfoodVirtualTable(unitId);
  const customerName = dto.customer?.name || 'Cliente iFood';
  const customerPhone = dto.customer?.phone?.number || '';

  const session = await prisma.tableSession.create({
    data: {
      tableId: vtable.id,
      unitId,
      customerName,
      customerPhone,
      status: 'active',
    },
  });

  // Sequência diária
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const last = await prisma.order.findFirst({
    where: { unitId, createdAt: { gte: startOfDay } },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  const sequenceNumber = (last?.sequenceNumber || 0) + 1;

  // Itens: como não existem Products locais com esses IDs, criamos um "produto stub" genérico
  // ou linkamos a produtos existentes via externalCode se configurado.
  // Para simplificar no MVP: se tiver externalCode mapeado para productId local, usa; senão cria stub.
  const itemsData = await Promise.all(dto.items.map(async (it) => {
    const unitPrice = it.unitPrice?.value ?? it.price?.value ?? 0;
    const totalPrice = it.totalPrice?.value ?? unitPrice * it.quantity;

    // Tenta casar por externalCode (productId local) ou ifoodItemId
    let productId: string | null = null;
    if (it.externalCode) {
      const p = await prisma.product.findFirst({
        where: { unitId, id: it.externalCode },
      });
      if (p) productId = p.id;
    }
    if (!productId && it.id) {
      const p = await prisma.product.findFirst({
        where: { unitId, ifoodItemId: it.id } as any,
      });
      if (p) productId = p.id;
    }

    // Fallback: cria/usa produto "Stub iFood" para manter FK válida
    if (!productId) {
      productId = await getOrCreateStubProduct(unitId);
    }

    const obsParts: string[] = [];
    if (it.observations) obsParts.push(it.observations);
    if (it.options?.length) {
      for (const o of it.options) {
        obsParts.push(`+ ${o.quantity}x ${o.name}`);
      }
    }

    return {
      productId,
      name: it.name,
      quantity: it.quantity,
      unitPrice,
      totalPrice,
      notes: obsParts.join(' | ') || null,
      station: 'cozinha',
    };
  }));

  const subtotal = itemsData.reduce((s, i) => s + i.totalPrice, 0);
  const serviceFee = 0; // iFood não aplica taxa de serviço local
  const total = dto.total?.orderAmount ?? subtotal;

  const deliveryAddress = dto.delivery?.deliveryAddress?.formattedAddress
    || [dto.delivery?.deliveryAddress?.streetName, dto.delivery?.deliveryAddress?.streetNumber,
        dto.delivery?.deliveryAddress?.neighborhood, dto.delivery?.deliveryAddress?.city]
       .filter(Boolean).join(', ')
    || null;

  const created = await prisma.order.create({
    data: {
      sessionId: session.id,
      unitId,
      tableId: vtable.id,
      sequenceNumber,
      status: 'received',
      subtotal,
      serviceFee,
      total,
      notes: dto.extraInfo || null,
      channel: 'ifood',
      ifoodOrderId: dto.id,
      ifoodDisplayId: dto.displayId,
      ifoodStatus: dto.status || 'PLACED',
      customerName,
      customerPhone,
      deliveryAddress,
      items: { create: itemsData },
    },
    include: { items: true, table: true },
  });

  // Atualiza total da sessão
  await prisma.tableSession.update({
    where: { id: session.id },
    data: { totalAmount: total },
  });

  // Emite para KDS/Waiters/Dashboard
  const payload = serializeOrder(created);
  emitToKitchen(unitId, SocketEvents.ORDER_CREATED, payload);
  emitToWaiters(unitId, SocketEvents.ORDER_CREATED, payload);
  emitToDashboard(unitId, SocketEvents.ORDER_CREATED, payload);

  return { order: created, created: true };
}

/**
 * Cancela localmente um pedido iFood (quando recebemos evento CAN ou fazemos /requestCancellation).
 */
export async function cancelIfoodOrderLocally(ifoodOrderId: string, reason?: string) {
  const order = await prisma.order.findFirst({
    where: { ifoodOrderId },
    include: { items: true, table: true },
  });
  if (!order) return null;
  if (order.status === 'cancelled') return order;

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'cancelled',
      ifoodStatus: 'CANCELLED',
      notes: reason
        ? `${order.notes ? order.notes + '\n' : ''}[iFood cancelou: ${reason}]`
        : order.notes,
    },
    include: { items: true, table: true },
  });

  const payload = serializeOrder(updated);
  emitToKitchen(order.unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToWaiters(order.unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToDashboard(order.unitId, SocketEvents.ORDER_UPDATED, payload);
  return updated;
}

/**
 * Cria (ou recupera) o produto "stub" usado para itens iFood sem correspondência local.
 * Mantém a FK de OrderItem válida sem exigir cadastro prévio.
 */
async function getOrCreateStubProduct(unitId: string): Promise<string> {
  const STUB_NAME = '[iFood] Item Externo';
  const existing = await prisma.product.findFirst({
    where: { unitId, name: STUB_NAME },
  });
  if (existing) return existing.id;

  // Precisamos de uma categoria também
  let category = await prisma.category.findFirst({
    where: { unitId, name: 'iFood' },
  });
  if (!category) {
    category = await prisma.category.create({
      data: { unitId, name: 'iFood', active: false, sortOrder: 9999 },
    });
  }

  const stub = await prisma.product.create({
    data: {
      unitId,
      categoryId: category.id,
      name: STUB_NAME,
      description: 'Produto gerado automaticamente para itens do iFood sem correspondência local.',
      price: 0,
      active: false,
      available: false,
      station: 'cozinha',
    },
  });
  return stub.id;
}
