import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, notFound, parseBody, serverError } from '@/lib/api';
import { orderStatusSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToKitchen, emitToSession, emitToDashboard, SocketEvents } from '@/lib/socket';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.KITCHEN);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, orderStatusSchema);
    if (!p.ok) return p.res;

    const now = new Date();
    const status = (p.data as any).status as string;
    const extra: any = {};
    if (status === 'accepted') extra.acceptedAt = now;
    if (status === 'ready') extra.readyAt = now;
    if (status === 'delivered') extra.deliveredAt = now;

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return notFound();

    const order = await prisma.order.update({
      where: { id },
      data: { status, ...extra },
      include: { items: true, table: { select: { number: true } } },
    });

    emitToKitchen(order.unitId, SocketEvents.ORDER_UPDATED, order);
    emitToDashboard(order.unitId, SocketEvents.ORDER_UPDATED, order);
    emitToSession(order.sessionId, SocketEvents.ORDER_STATUS_CHANGED, {
      orderId: order.id, status: order.status, at: now,
    });

    return ok({ order });
  } catch (e) { return serverError(e); }
}
