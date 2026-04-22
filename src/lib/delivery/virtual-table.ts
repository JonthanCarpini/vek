// Helpers para obter/criar entidades virtuais usadas pelos pedidos de delivery/takeout.
// Cada pedido de delivery é associado a uma "mesa virtual" + uma "sessão virtual por pedido"
// para manter integridade referencial com o modelo atual (Order.tableId e sessionId obrigatórios).
//
// - Mesa virtual #9998 = todos pedidos de delivery/takeout dessa unidade
// - Sessão virtual: uma por pedido (customerName/phone do próprio pedido)

import { prisma } from '@/lib/prisma';

export const DELIVERY_VIRTUAL_TABLE_NUMBER = 9998;

/**
 * Obtém (ou cria na primeira chamada) o id da mesa virtual de delivery da unidade.
 */
export async function getOrCreateDeliveryVirtualTable(unitId: string): Promise<string> {
  const existing = await prisma.tableEntity.findFirst({
    where: {
      unitId,
      number: DELIVERY_VIRTUAL_TABLE_NUMBER,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.tableEntity.create({
    data: {
      unitId,
      number: DELIVERY_VIRTUAL_TABLE_NUMBER,
      label: 'Delivery',
      capacity: 0,
      virtual: true,
      qrToken: `delivery-virtual-${unitId}`,
    },
  });

  return created.id;
}

/**
 * Cria uma sessão virtual para um pedido de delivery.
 * Diferente do dine_in, cada pedido delivery tem sua própria sessão curta
 * que é fechada junto com a entrega.
 */
export async function createDeliverySession(params: {
  unitId: string;
  tableId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
}): Promise<string> {
  const session = await prisma.tableSession.create({
    data: {
      unitId: params.unitId,
      tableId: params.tableId,
      customerId: params.customerId || null,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      status: 'active',
    } as any,
  });
  return session.id;
}
