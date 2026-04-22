import { NextRequest } from 'next/server';
import { ok, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/guard';

/**
 * GET /api/v1/driver/stats
 * Retorna métricas do motoboy logado: hoje / semana / mês.
 * Para cada período: entregas concluídas, ticket médio, km rodados, comissão.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireDriver(req);
    if (!g.ok) return g.res;

    const driver = await (prisma as any).driver.findUnique({
      where: { id: g.driver.sub },
      select: {
        id: true, name: true, totalDeliveries: true,
        commissionPerDelivery: true, commissionPercent: true,
      },
    });
    if (!driver) return ok({ stats: null });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // domingo
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const perDelivery = driver.commissionPerDelivery ? Number(driver.commissionPerDelivery) : 0;
    const percent = driver.commissionPercent ? Number(driver.commissionPercent) : 0;

    async function summarize(since: Date) {
      const orders = await prisma.order.findMany({
        where: {
          driverId: driver.id,
          channel: 'delivery',
          status: 'delivered',
          deliveredAt: { gte: since },
        },
        select: {
          total: true, subtotal: true, deliveryFee: true, distanceKm: true,
        } as any,
      }) as any[];

      const count = orders.length;
      const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
      const km = orders.reduce((s, o) => s + Number(o.distanceKm || 0), 0);
      const feeSum = orders.reduce((s, o) => s + Number(o.deliveryFee || 0), 0);
      const commission = (perDelivery * count) + (feeSum * percent / 100);
      const avgTicket = count > 0 ? revenue / count : 0;
      return { count, revenue, km, avgTicket, commission, feeSum };
    }

    const [today, week, month] = await Promise.all([
      summarize(startOfToday),
      summarize(startOfWeek),
      summarize(startOfMonth),
    ]);

    return ok({
      stats: {
        driver: {
          id: driver.id,
          name: driver.name,
          totalDeliveries: driver.totalDeliveries,
          commissionPerDelivery: perDelivery,
          commissionPercent: percent,
        },
        today, week, month,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
