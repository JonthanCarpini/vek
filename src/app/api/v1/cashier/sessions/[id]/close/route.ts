import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { emitToSession, emitToDashboard, SocketEvents } from '@/lib/socket';
import { closeSessionSchema } from '@/lib/validators';
import { getCurrentStoreDay } from '@/lib/store';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;

    // Body opcional (payments inline + force)
    let parsed: any = { payments: [], force: false };
    try {
      const p = await parseBody(req, closeSessionSchema);
      if (p.ok) parsed = p.data;
    } catch {}

    const session = await prisma.tableSession.findUnique({
      where: { id },
      include: {
        orders: { where: { status: { not: 'cancelled' } }, include: { items: true } },
        payments: true,
      },
    });
    if (!session) return notFound();
    if (session.status === 'closed') return fail('Sessão já fechada', 409);

    const day = await getCurrentStoreDay(g.staff.unitId);

    // Cria pagamentos inline (se enviados)
    if (Array.isArray(parsed.payments) && parsed.payments.length > 0) {
      await prisma.sessionPayment.createMany({
        data: parsed.payments.map((pay: any) => ({
          sessionId: id,
          storeDayId: day?.id,
          method: pay.method,
          amount: pay.amount,
          changeGiven: pay.changeGiven || 0,
          reference: pay.reference || null,
          partLabel: pay.partLabel || null,
          notes: pay.notes || null,
          createdByUserId: g.staff.sub,
        })),
      });
    }

    const subtotal = session.orders.reduce(
      (sum: number, o: any) => sum + o.items.reduce((a: number, i: any) => a + Number(i.unitPrice) * i.quantity, 0),
      0,
    );
    const allPayments = await prisma.sessionPayment.findMany({ where: { sessionId: id } });
    const paid = allPayments.reduce((s: number, p: any) => s + Number(p.amount) - Number(p.changeGiven), 0);
    const remaining = Number((subtotal - paid).toFixed(2));

    if (remaining > 0.009 && !parsed.force) {
      return fail(`Falta pagar R$ ${remaining.toFixed(2).replace('.', ',')}`, 409);
    }

    const closed = await prisma.tableSession.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date(), totalAmount: subtotal },
    });
    await prisma.tableEntity.update({ where: { id: session.tableId }, data: { status: 'free' } });

    // Atualiza estatísticas do cliente (se vinculado)
    if (session.customerId) {
      await prisma.customer.update({
        where: { id: session.customerId },
        data: {
          totalSpent: { increment: subtotal },
          totalOrders: { increment: session.orders.length },
          lastSeenAt: new Date(),
        },
      });
    }

    emitToSession(id, SocketEvents.SESSION_CLOSED, { sessionId: id });
    emitToDashboard(session.unitId, SocketEvents.SESSION_CLOSED, { sessionId: id });

    return ok({ session: closed, subtotal, paid, remaining });
  } catch (e) { return serverError(e); }
}
