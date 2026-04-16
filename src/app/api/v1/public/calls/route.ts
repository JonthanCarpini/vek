import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError, unauthorized } from '@/lib/api';
import { createCallSchema } from '@/lib/validators';
import { getSessionFromRequest } from '@/lib/auth';
import { emitToWaiters, SocketEvents } from '@/lib/socket';

export async function POST(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const parsed = await parseBody(req, createCallSchema);
    if (!parsed.ok) return parsed.res;
    const call = await prisma.call.create({
      data: { sessionId: s.sid, tableId: s.tid, unitId: s.uid, type: parsed.data.type, status: 'pending' },
      include: { table: true },
    });
    emitToWaiters(s.uid, SocketEvents.CALL_CREATED, {
      id: call.id, type: call.type, tableId: call.tableId, tableNumber: call.table.number,
      createdAt: call.createdAt, customerName: s.name,
    });
    return ok({ call: { id: call.id, type: call.type, status: call.status, createdAt: call.createdAt } });
  } catch (e) { return serverError(e); }
}
