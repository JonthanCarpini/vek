import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { sessionPaymentSchema } from '@/lib/validators';
import { getCurrentStoreDay } from '@/lib/store';
import { emitToSession, emitToDashboard } from '@/lib/socket';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;

    const session = await prisma.tableSession.findUnique({ where: { id } });
    if (!session) return notFound();
    if (session.status === 'closed') return fail('Sessão já fechada', 409);

    const p = await parseBody(req, sessionPaymentSchema);
    if (!p.ok) return p.res;

    const day = await getCurrentStoreDay(g.staff.unitId);

    const payment = await prisma.sessionPayment.create({
      data: {
        sessionId: id,
        storeDayId: day?.id,
        method: p.data.method,
        amount: p.data.amount,
        changeGiven: p.data.changeGiven || 0,
        reference: p.data.reference || null,
        partLabel: p.data.partLabel || null,
        notes: p.data.notes || null,
        createdByUserId: g.staff.sub,
      },
    });

    emitToSession(id, 'session.payment_added', { sessionId: id, payment });
    emitToDashboard(session.unitId, 'session.payment_added', { sessionId: id });

    return ok({ payment });
  } catch (e) { return serverError(e); }
}
