import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, unauthorized } from '@/lib/api';
import { createOrderSchema } from '@/lib/validators';
import { getSessionFromRequest } from '@/lib/auth';
import { emitToKitchen, emitToSession, emitToDashboard, SocketEvents } from '@/lib/socket';

export async function GET(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const orders = await prisma.order.findMany({
      where: { sessionId: s.sid },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return ok({ orders: orders.map(serializeOrder) });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();

    const parsed = await parseBody(req, createOrderSchema);
    if (!parsed.ok) return parsed.res;

    const productIds = parsed.data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, unitId: s.uid, active: true, available: true },
    });
    if (products.length !== productIds.length) return fail('Produto indisponível', 409);

    const unit = await prisma.unit.findUnique({ where: { id: s.uid } });
    const serviceFeeRate = unit ? Number(unit.serviceFee) : 0;

    let subtotal = 0;
    const itemsData = parsed.data.items.map((i) => {
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

    // Numeração sequencial diária por unidade
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const last = await prisma.order.findFirst({
      where: { unitId: s.uid, createdAt: { gte: startOfDay } },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (last?.sequenceNumber || 0) + 1;

    const order = await prisma.order.create({
      data: {
        sessionId: s.sid,
        unitId: s.uid,
        tableId: s.tid,
        sequenceNumber,
        status: 'received',
        subtotal, serviceFee, total,
        notes: parsed.data.notes || null,
        items: { create: itemsData },
      },
      include: { items: true, table: true },
    });

    // Atualiza total da sessão
    await prisma.tableSession.update({
      where: { id: s.sid },
      data: { totalAmount: { increment: total } },
    });

    const payload = serializeOrder(order);
    emitToKitchen(s.uid, SocketEvents.ORDER_CREATED, payload);
    emitToSession(s.sid, SocketEvents.ORDER_STATUS_CHANGED, payload);
    emitToDashboard(s.uid, SocketEvents.ORDER_CREATED, payload);

    return ok({ order: payload });
  } catch (e) { return serverError(e); }
}

function serializeOrder(o: any) {
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
