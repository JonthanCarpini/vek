import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError } from '@/lib/api';
import { itemStatusSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToKitchen, emitToSession, SocketEvents } from '@/lib/socket';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.KITCHEN);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, itemStatusSchema);
    if (!p.ok) return p.res;
    const status = (p.data as any).status as string;
    const item = await prisma.orderItem.update({
      where: { id }, data: { status },
      include: { order: { select: { id: true, unitId: true, sessionId: true } } },
    });
    emitToKitchen(item.order.unitId, SocketEvents.ITEM_STATUS_CHANGED, { itemId: item.id, orderId: item.orderId, status });
    emitToSession(item.order.sessionId, SocketEvents.ITEM_STATUS_CHANGED, { itemId: item.id, orderId: item.orderId, status });
    return ok({ item });
  } catch (e) { return serverError(e); }
}
