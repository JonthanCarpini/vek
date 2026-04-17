import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToKitchen, emitToSession, emitToDashboard, emitToWaiters, SocketEvents } from '@/lib/socket';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    const { id } = await params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return notFound();
    if (order.status !== 'ready') return fail('Pedido não está pronto', 409);
    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
    const payload = { orderId: id, status: 'delivered' };
    emitToKitchen(order.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
    emitToWaiters(order.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
    emitToSession(order.sessionId, SocketEvents.ORDER_STATUS_CHANGED, payload);
    emitToDashboard(order.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
    return ok({ order: updated });
  } catch (e) { return serverError(e); }
}
