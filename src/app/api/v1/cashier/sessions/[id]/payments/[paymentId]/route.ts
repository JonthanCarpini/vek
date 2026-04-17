import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToSession } from '@/lib/socket';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    const { id, paymentId } = await params;
    const payment = await prisma.sessionPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.sessionId !== id) return notFound();
    const session = await prisma.tableSession.findUnique({ where: { id } });
    if (!session) return notFound();
    if (session.status === 'closed') return fail('Sessão já fechada', 409);
    await prisma.sessionPayment.delete({ where: { id: paymentId } });
    emitToSession(id, 'session.payment_removed', { sessionId: id, paymentId });
    return ok({ removed: true });
  } catch (e) { return serverError(e); }
}
