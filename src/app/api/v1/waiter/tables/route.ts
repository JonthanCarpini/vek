import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);

    const sessions = await prisma.tableSession.findMany({
      where: { unitId: g.staff.unitId, status: 'active' },
      orderBy: { openedAt: 'asc' },
      include: {
        table: { select: { id: true, number: true, label: true, status: true } },
        orders: {
          where: { status: { not: 'cancelled' } },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const data = sessions.map((s: any) => {
      const subtotal = s.orders.reduce(
        (sum: number, o: any) => sum + o.items.reduce((a: number, i: any) => a + Number(i.unitPrice) * i.quantity, 0),
        0,
      );
      const pendingOrders = s.orders.filter((o: any) => ['received', 'accepted', 'preparing'].includes(o.status)).length;
      const readyOrders = s.orders.filter((o: any) => o.status === 'ready').length;
      return {
        id: s.id,
        openedAt: s.openedAt,
        customerName: s.customerName,
        table: s.table,
        orders: s.orders,
        orderCount: s.orders.length,
        pendingOrders,
        readyOrders,
        subtotal,
      };
    });

    return ok({ sessions: data });
  } catch (e) { return serverError(e); }
}
