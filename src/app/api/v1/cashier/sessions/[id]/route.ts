import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError, notFound, fail } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;

    const session = await prisma.tableSession.findUnique({
      where: { id },
      include: {
        table: { select: { id: true, number: true, label: true } },
        orders: {
          where: { status: { not: 'cancelled' } },
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) return notFound();

    const subtotal = session.orders.reduce(
      (sum: number, o: any) => sum + o.items.reduce((a: number, i: any) => a + Number(i.unitPrice) * i.quantity, 0),
      0,
    );
    const paid = session.payments.reduce((s: number, p: any) => s + Number(p.amount) - Number(p.changeGiven), 0);
    const remaining = Math.max(0, Number((subtotal - paid).toFixed(2)));

    return ok({
      session: {
        ...session,
        subtotal,
        paid,
        remaining,
      },
    });
  } catch (e) { return serverError(e); }
}
