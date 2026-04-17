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
      },
    });

    const data = sessions.map((s) => {
      const subtotal = s.orders.reduce((sum, o) => sum + o.items.reduce((a, i) => a + Number(i.unitPrice) * i.quantity, 0), 0);
      const status = s.orders.every((o) => o.status === 'delivered') && s.orders.length > 0 ? 'ready_to_close' : 'open';
      return {
        id: s.id,
        openedAt: s.openedAt,
        customerName: s.customerName,
        table: s.table,
        orderCount: s.orders.length,
        subtotal,
        status,
      };
    });

    return ok({ sessions: data });
  } catch (e) { return serverError(e); }
}
