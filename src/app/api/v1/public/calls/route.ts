import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError, unauthorized } from '@/lib/api';
import { createCallSchema } from '@/lib/validators';
import { getSessionFromRequest } from '@/lib/auth';
import { emitToWaiters, emitToDashboard, SocketEvents } from '@/lib/socket';

export async function POST(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const parsed = await parseBody(req, createCallSchema);
    if (!parsed.ok) return parsed.res;

    // Evita spam: se já existe chamada pendente do mesmo tipo na sessão, reutiliza (atualiza reason).
    const existing = await prisma.call.findFirst({
      where: { sessionId: s.sid, type: parsed.data.type, status: 'pending' },
    });
    const call = existing
      ? await prisma.call.update({
          where: { id: existing.id },
          data: {
            reason: parsed.data.reason ?? existing.reason,
            paymentHint: parsed.data.paymentHint ?? existing.paymentHint,
            splitCount: parsed.data.splitCount ?? existing.splitCount,
          },
          include: { table: true },
        })
      : await prisma.call.create({
          data: {
            sessionId: s.sid,
            tableId: s.tid,
            unitId: s.uid,
            type: parsed.data.type,
            reason: parsed.data.reason || null,
            paymentHint: parsed.data.paymentHint || null,
            splitCount: parsed.data.splitCount || null,
            status: 'pending',
          },
          include: { table: true },
        });

    const payload = {
      id: call.id, type: call.type, reason: call.reason, paymentHint: call.paymentHint, splitCount: call.splitCount,
      tableId: call.tableId, tableNumber: call.table.number, createdAt: call.createdAt, customerName: s.name,
    };

    emitToWaiters(s.uid, SocketEvents.CALL_CREATED, payload);
    emitToDashboard(s.uid, SocketEvents.CALL_CREATED, payload);
    
    return ok({ call: { id: call.id, type: call.type, reason: call.reason, paymentHint: call.paymentHint, status: call.status, createdAt: call.createdAt } });
  } catch (e) { return serverError(e); }
}

export async function GET(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const calls = await prisma.call.findMany({
      where: { sessionId: s.sid },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return ok({ calls });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return ok({ ok: false });
    const call = await prisma.call.findFirst({ where: { id, sessionId: s.sid, status: 'pending' } });
    if (!call) return ok({ ok: false });
    await prisma.call.update({ where: { id }, data: { status: 'cancelled' } });
    return ok({ ok: true });
  } catch (e) { return serverError(e); }
}
