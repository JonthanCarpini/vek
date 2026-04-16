import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToSession, emitToDashboard, SocketEvents } from '@/lib/socket';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    const { id } = await params;
    const session = await prisma.tableSession.findUnique({ where: { id } });
    if (!session) return notFound();

    const closed = await prisma.tableSession.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
    });
    await prisma.tableEntity.update({ where: { id: session.tableId }, data: { status: 'free' } });

    emitToSession(id, SocketEvents.SESSION_CLOSED, { sessionId: id });
    emitToDashboard(session.unitId, SocketEvents.SESSION_CLOSED, { sessionId: id });

    return ok({ session: closed });
  } catch (e) { return serverError(e); }
}
