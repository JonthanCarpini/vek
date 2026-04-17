import { prisma } from '@/lib/prisma';
import { emitToKitchen, emitToWaiters, emitToSession, emitToDashboard, SocketEvents } from '@/lib/socket';

export type CreateOrderItemInput = {
  productId: string;
  quantity: number;
  notes?: string | null;
};

export type CreateOrderResult =
  | { ok: true; order: any }
  | { ok: false; status: number; message: string };

/**
 * Cria um pedido a partir de itens, validando estoque e deduzindo ingredientes.
 * Usado pelos endpoints publico (/public/orders) e waiter (/waiter/orders).
 */
export async function createOrderFromItems(params: {
  unitId: string;
  sessionId: string;
  tableId: string;
  items: CreateOrderItemInput[];
  notes?: string | null;
}): Promise<CreateOrderResult> {
  const { unitId, sessionId, tableId, items, notes } = params;

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, unitId, active: true, available: true },
    include: {
      ingredients: { where: { optional: false }, include: { ingredient: true } },
    },
  });
  if (products.length !== productIds.length) {
    return { ok: false, status: 409, message: 'Produto indisponivel' };
  }

  // Agrega ingredientes necessarios
  const needed = new Map<string, { name: string; qty: number; stock: number; unit: string }>();
  for (const item of items) {
    const p = products.find((x: any) => x.id === item.productId)!;
    for (const pi of (p as any).ingredients || []) {
      const total = Number(pi.quantity) * item.quantity;
      const cur = needed.get(pi.ingredientId);
      if (cur) cur.qty += total;
      else needed.set(pi.ingredientId, {
        name: pi.ingredient.name,
        qty: total,
        stock: Number(pi.ingredient.stock),
        unit: pi.ingredient.unitOfMeasure,
      });
    }
  }
  for (const [, n] of needed) {
    if (n.qty > n.stock) {
      return {
        ok: false,
        status: 409,
        message: `Estoque insuficiente de "${n.name}" (necessario ${n.qty}${n.unit}, disponivel ${n.stock}${n.unit})`,
      };
    }
  }

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  const serviceFeeRate = unit ? Number(unit.serviceFee) : 0;

  let subtotal = 0;
  const itemsData = items.map((i) => {
    const p = products.find((x) => x.id === i.productId)!;
    const unitPrice = Number(p.price);
    const totalPrice = unitPrice * i.quantity;
    subtotal += totalPrice;
    return {
      productId: p.id,
      name: p.name,
      quantity: i.quantity,
      unitPrice,
      totalPrice,
      notes: i.notes || null,
      station: p.station,
    };
  });

  const serviceFee = subtotal * serviceFeeRate;
  const total = subtotal + serviceFee;

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const last = await prisma.order.findFirst({
    where: { unitId, createdAt: { gte: startOfDay } },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  const sequenceNumber = (last?.sequenceNumber || 0) + 1;

  const order = await prisma.$transaction(async (tx: any) => {
    const created = await tx.order.create({
      data: {
        sessionId, unitId, tableId, sequenceNumber,
        status: 'received',
        subtotal, serviceFee, total,
        notes: notes || null,
        items: { create: itemsData },
      },
      include: { items: true, table: true },
    });

    for (const [ingId, n] of needed) {
      await tx.ingredient.update({
        where: { id: ingId },
        data: { stock: { decrement: n.qty } },
      });
      await tx.auditLog.create({
        data: {
          action: 'stock_deduct',
          entity: 'Ingredient',
          entityId: ingId,
          diff: JSON.stringify({ orderId: created.id, qty: n.qty, reason: 'order_created' }),
        },
      });
    }

    await tx.tableSession.update({
      where: { id: sessionId },
      data: { totalAmount: { increment: total } },
    });
    return created;
  });

  const payload = serializeOrder(order);
  emitToKitchen(unitId, SocketEvents.ORDER_CREATED, payload);
  emitToWaiters(unitId, SocketEvents.ORDER_CREATED, payload);
  emitToDashboard(unitId, SocketEvents.ORDER_CREATED, payload);
  emitToSession(sessionId, SocketEvents.ORDER_STATUS_CHANGED, payload);

  return { ok: true, order: payload };
}

/**
 * Adiciona itens a um pedido existente (apenas se ainda nao foi entregue/cancelado).
 * Uso pelo garcom: cliente esqueceu de incluir algo, ou pede mais.
 */
export async function addItemsToOrder(params: {
  orderId: string;
  unitId: string;
  items: CreateOrderItemInput[];
}): Promise<CreateOrderResult> {
  const { orderId, unitId, items } = params;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.unitId !== unitId) return { ok: false, status: 404, message: 'Pedido nao encontrado' };
  if (['delivered', 'cancelled'].includes(order.status)) {
    return { ok: false, status: 409, message: 'Pedido ja finalizado nao pode receber itens' };
  }

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, unitId, active: true, available: true },
    include: { ingredients: { where: { optional: false }, include: { ingredient: true } } },
  });
  if (products.length !== productIds.length) return { ok: false, status: 409, message: 'Produto indisponivel' };

  const needed = new Map<string, { name: string; qty: number; stock: number; unit: string }>();
  for (const item of items) {
    const p = products.find((x: any) => x.id === item.productId)!;
    for (const pi of (p as any).ingredients || []) {
      const total = Number(pi.quantity) * item.quantity;
      const cur = needed.get(pi.ingredientId);
      if (cur) cur.qty += total;
      else needed.set(pi.ingredientId, {
        name: pi.ingredient.name, qty: total,
        stock: Number(pi.ingredient.stock), unit: pi.ingredient.unitOfMeasure,
      });
    }
  }
  for (const [, n] of needed) {
    if (n.qty > n.stock) return { ok: false, status: 409, message: `Estoque insuficiente de "${n.name}"` };
  }

  let addedSubtotal = 0;
  const itemsData = items.map((i) => {
    const p = products.find((x) => x.id === i.productId)!;
    const unitPrice = Number(p.price);
    const totalPrice = unitPrice * i.quantity;
    addedSubtotal += totalPrice;
    return {
      orderId, productId: p.id, name: p.name,
      quantity: i.quantity, unitPrice, totalPrice,
      notes: i.notes || null, station: p.station,
    };
  });

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  const serviceFeeRate = unit ? Number(unit.serviceFee) : 0;
  const addedServiceFee = addedSubtotal * serviceFeeRate;
  const addedTotal = addedSubtotal + addedServiceFee;

  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.orderItem.createMany({ data: itemsData });
    for (const [ingId, n] of needed) {
      await tx.ingredient.update({ where: { id: ingId }, data: { stock: { decrement: n.qty } } });
    }
    const upd = await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal: { increment: addedSubtotal },
        serviceFee: { increment: addedServiceFee },
        total: { increment: addedTotal },
        // Volta o status para received se ja estava ready/preparing, para a cozinha ver os novos
        ...(order.status === 'ready' || order.status === 'delivered' ? {} : {}),
      },
      include: { items: true, table: true },
    });
    await tx.tableSession.update({
      where: { id: order.sessionId },
      data: { totalAmount: { increment: addedTotal } },
    });
    return upd;
  });

  const payload = serializeOrder(updated);
  emitToKitchen(unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToWaiters(unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToSession(order.sessionId, SocketEvents.ORDER_UPDATED, payload);
  emitToDashboard(unitId, SocketEvents.ORDER_UPDATED, payload);
  return { ok: true, order: payload };
}

/**
 * Cancela um item do pedido. Restitui estoque.
 */
export async function cancelOrderItem(params: { itemId: string; unitId: string; reason?: string }): Promise<CreateOrderResult> {
  const { itemId, unitId, reason } = params;
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true },
  });
  if (!item || item.order.unitId !== unitId) return { ok: false, status: 404, message: 'Item nao encontrado' };
  if (item.status === 'cancelled') return { ok: false, status: 409, message: 'Item ja cancelado' };
  if (item.order.status === 'delivered') return { ok: false, status: 409, message: 'Pedido ja entregue' };

  // Recupera ingredientes para restituir estoque
  const pis = await prisma.productIngredient.findMany({
    where: { productId: item.productId, optional: false },
  });
  const itemTotal = Number(item.unitPrice) * item.quantity;
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  const serviceFeeRate = unit ? Number(unit.serviceFee) : 0;
  const itemServiceFee = itemTotal * serviceFeeRate;
  const itemGrand = itemTotal + itemServiceFee;

  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.orderItem.update({
      where: { id: itemId },
      data: { status: 'cancelled', notes: reason ? `[Cancelado: ${reason}]` : item.notes },
    });
    // Restitui estoque
    for (const pi of pis) {
      await tx.ingredient.update({
        where: { id: pi.ingredientId },
        data: { stock: { increment: Number(pi.quantity) * item.quantity } },
      });
    }
    // Ajusta totais do pedido
    const upd = await tx.order.update({
      where: { id: item.order.id },
      data: {
        subtotal: { decrement: itemTotal },
        serviceFee: { decrement: itemServiceFee },
        total: { decrement: itemGrand },
      },
      include: { items: true, table: true },
    });
    // Ajusta totais da sessao
    await tx.tableSession.update({
      where: { id: item.order.sessionId },
      data: { totalAmount: { decrement: itemGrand } },
    });
    return upd;
  });

  const payload = serializeOrder(updated);
  emitToKitchen(unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToWaiters(unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToSession(item.order.sessionId, SocketEvents.ORDER_UPDATED, payload);
  emitToDashboard(unitId, SocketEvents.ORDER_UPDATED, payload);
  return { ok: true, order: payload };
}

/**
 * Cancela o pedido inteiro (marca como cancelled, cancela todos os itens ativos, restitui estoque).
 */
export async function cancelOrder(params: { orderId: string; unitId: string; reason?: string }): Promise<CreateOrderResult> {
  const { orderId, unitId, reason } = params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { status: { not: 'cancelled' } } } },
  });
  if (!order || order.unitId !== unitId) return { ok: false, status: 404, message: 'Pedido nao encontrado' };
  if (order.status === 'cancelled') return { ok: false, status: 409, message: 'Pedido ja cancelado' };
  if (order.status === 'delivered') return { ok: false, status: 409, message: 'Pedido ja entregue' };

  const updated = await prisma.$transaction(async (tx: any) => {
    // Restitui estoque de todos os itens ativos
    for (const it of order.items) {
      const pis = await tx.productIngredient.findMany({
        where: { productId: it.productId, optional: false },
      });
      for (const pi of pis) {
        await tx.ingredient.update({
          where: { id: pi.ingredientId },
          data: { stock: { increment: Number(pi.quantity) * it.quantity } },
        });
      }
    }
    await tx.orderItem.updateMany({
      where: { orderId, status: { not: 'cancelled' } },
      data: { status: 'cancelled' },
    });
    const upd = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        notes: reason ? `[Cancelado pelo garcom: ${reason}]` : order.notes,
      },
      include: { items: true, table: true },
    });
    // Ajusta total da sessao (tira o total do pedido)
    await tx.tableSession.update({
      where: { id: order.sessionId },
      data: { totalAmount: { decrement: Number(order.total) } },
    });
    return upd;
  });

  const payload = serializeOrder(updated);
  emitToKitchen(unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToWaiters(unitId, SocketEvents.ORDER_UPDATED, payload);
  emitToSession(order.sessionId, SocketEvents.ORDER_UPDATED, payload);
  emitToDashboard(unitId, SocketEvents.ORDER_UPDATED, payload);
  return { ok: true, order: payload };
}

export function serializeOrder(o: any) {
  return {
    id: o.id,
    sequenceNumber: o.sequenceNumber,
    status: o.status,
    subtotal: Number(o.subtotal),
    serviceFee: Number(o.serviceFee),
    total: Number(o.total),
    notes: o.notes,
    tableId: o.tableId,
    tableNumber: o.table?.number,
    createdAt: o.createdAt,
    acceptedAt: o.acceptedAt,
    readyAt: o.readyAt,
    deliveredAt: o.deliveredAt,
    items: (o.items || []).map((i: any) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      notes: i.notes,
      status: i.status,
      station: i.station,
    })),
  };
}
