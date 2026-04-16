import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    const [ordersToday, openTables, pendingCalls, revenueAgg, activeOrders] = await Promise.all([
      prisma.order.count({ where: { unitId, createdAt: { gte: startOfDay } } }),
      prisma.tableEntity.count({ where: { unitId, status: 'occupied' } }),
      prisma.call.count({ where: { unitId, status: 'pending' } }),
      prisma.order.aggregate({
        where: { unitId, createdAt: { gte: startOfDay }, status: { not: 'cancelled' } },
        _sum: { total: true },
        _avg: { total: true },
      }),
      prisma.order.count({ where: { unitId, status: { in: ['received', 'accepted', 'preparing', 'ready'] } } }),
    ]);

    return ok({
      dashboard: {
        ordersToday,
        openTables,
        pendingCalls,
        activeOrders,
        revenueToday: Number(revenueAgg._sum.total ?? 0),
        avgTicket: Number(revenueAgg._avg.total ?? 0),
      },
    });
  } catch (e) { return serverError(e); }
}
