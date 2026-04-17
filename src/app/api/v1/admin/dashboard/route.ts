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

    // Seleciona StoreDay: id específico, ou o aberto atual, ou o último fechado.
    const storeDayIdParam = req.nextUrl.searchParams.get('storeDayId');
    let day = null as any;
    if (storeDayIdParam) {
      day = await prisma.storeDay.findUnique({ where: { id: storeDayIdParam } });
    } else {
      day = await prisma.storeDay.findFirst({
        where: { unitId, status: 'open' },
        orderBy: { openedAt: 'desc' },
      });
      if (!day) {
        day = await prisma.storeDay.findFirst({
          where: { unitId, status: 'closed' },
          orderBy: { closedAt: 'desc' },
        });
      }
    }

    // Intervalo: do dia; fallback para meia-noite de hoje se não existe StoreDay.
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const periodStart: Date = day ? new Date(day.openedAt) : startOfDay;
    const periodEnd: Date = day?.closedAt ? new Date(day.closedAt) : new Date();

    const [
      ordersCount, openTables, pendingCalls, revenueAgg, activeOrders,
      paymentByMethod, totalPayments, recentDays,
    ] = await Promise.all([
      prisma.order.count({
        where: { unitId, createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.tableEntity.count({ where: { unitId, status: 'occupied' } }),
      prisma.call.count({ where: { unitId, status: 'pending' } }),
      prisma.order.aggregate({
        where: {
          unitId,
          createdAt: { gte: periodStart, lte: periodEnd },
          status: { not: 'cancelled' },
        },
        _sum: { total: true },
        _avg: { total: true },
      }),
      prisma.order.count({
        where: { unitId, status: { in: ['received', 'accepted', 'preparing', 'ready'] } },
      }),
      day ? prisma.sessionPayment.groupBy({
        by: ['method'],
        where: { storeDayId: day.id },
        _sum: { amount: true, changeGiven: true },
      }) : Promise.resolve([] as any[]),
      day ? prisma.sessionPayment.aggregate({
        where: { storeDayId: day.id },
        _sum: { amount: true, changeGiven: true },
      }) : Promise.resolve({ _sum: { amount: 0, changeGiven: 0 } } as any),
      prisma.storeDay.findMany({
        where: { unitId, status: 'closed' },
        orderBy: { closedAt: 'desc' },
        take: 7,
        select: { id: true, openedAt: true, closedAt: true, totalSales: true, cashDiff: true },
      }),
    ]);

    const paidNet = Number(totalPayments._sum?.amount || 0) - Number(totalPayments._sum?.changeGiven || 0);

    return ok({
      dashboard: {
        storeDay: day ? {
          id: day.id,
          openedAt: day.openedAt,
          closedAt: day.closedAt,
          status: day.status,
          openingCash: Number(day.openingCash || 0),
          closingCash: day.closingCash != null ? Number(day.closingCash) : null,
          expectedCash: day.expectedCash != null ? Number(day.expectedCash) : null,
          cashDiff: day.cashDiff != null ? Number(day.cashDiff) : null,
          totalSales: day.totalSales != null ? Number(day.totalSales) : null,
        } : null,
        periodStart, periodEnd,
        ordersToday: ordersCount,
        openTables,
        pendingCalls,
        activeOrders,
        revenueToday: Number(revenueAgg._sum.total ?? 0),
        avgTicket: Number(revenueAgg._avg.total ?? 0),
        paidNet,
        paymentByMethod: paymentByMethod.map((p: any) => ({
          method: p.method,
          amount: Number(p._sum.amount || 0),
          changeGiven: Number(p._sum.changeGiven || 0),
          net: Number(p._sum.amount || 0) - Number(p._sum.changeGiven || 0),
        })),
        recentDays: recentDays.map((d: any) => ({
          id: d.id,
          openedAt: d.openedAt,
          closedAt: d.closedAt,
          totalSales: d.totalSales != null ? Number(d.totalSales) : 0,
          cashDiff: d.cashDiff != null ? Number(d.cashDiff) : 0,
        })),
      },
    });
  } catch (e) { return serverError(e); }
}

