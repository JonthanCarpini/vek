import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToWaiters, emitToSession, SocketEvents } from '@/lib/socket';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    const { id } = await params;
    const call = await prisma.call.update({
      where: { id },
      data: { status: 'attended', attendedAt: new Date(), attendedByUserId: g.staff.sub },
    });
    emitToWaiters(call.unitId, SocketEvents.CALL_ATTENDED, { id: call.id });
    emitToSession(call.sessionId, SocketEvents.CALL_ATTENDED, { id: call.id, type: call.type });
    return ok({ call });
  } catch (e) { return serverError(e); }
}
