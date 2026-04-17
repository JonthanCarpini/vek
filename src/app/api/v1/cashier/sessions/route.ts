import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError, fail } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);

    const sessions = await prisma.tableSession.findMany({
      where: { unitId: g.staff.unitId, closedAt: null },
      orderBy: { openedAt: 'asc' },
      include: {
        table: { select: { id: true, number: true, label: true } },
        orders: {
          where: { status: { not: 'cancelled' } },
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: true,
      },
    });

    const data = sessions.map((s: any) => {
      const subtotal = s.orders.reduce((sum: number, o: any) => sum + o.items.reduce((a: number, i: any) => a + Number(i.unitPrice) * i.quantity, 0), 0);
      const paid = s.payments.reduce((acc: number, p: any) => acc + Number(p.amount) - Number(p.changeGiven), 0);
      const remaining = Math.max(0, Number((subtotal - paid).toFixed(2)));
      const allDelivered = s.orders.length > 0 && s.orders.every((o: any) => o.status === 'delivered');
      const status = remaining <= 0 && subtotal > 0 ? 'ready_to_close' : allDelivered ? 'delivered' : 'open';
      return {
        id: s.id,
        openedAt: s.openedAt,
        customerName: s.customerName,
        table: s.table,
        orderCount: s.orders.length,
        subtotal,
        paid,
        remaining,
        status,
      };
    });

    return ok({ sessions: data });
  } catch (e) { return serverError(e); }
}
