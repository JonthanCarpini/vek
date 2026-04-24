import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);

    const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') || '7', 10), 90);
    const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0);

    const [orders, cancelledOrders] = await Promise.all([
      prisma.order.findMany({
        where: { unitId, createdAt: { gte: since }, status: { not: 'cancelled' } },
        select: {
          id: true, total: true, subtotal: true, deliveryFee: true,
          createdAt: true, acceptedAt: true, deliveredAt: true,
          channel: true, orderType: true, paymentMethod: true,
          items: { select: { name: true, quantity: true, totalPrice: true } },
        } as any,
      }) as any[],
      prisma.order.count({
        where: { unitId, createdAt: { gte: since }, status: 'cancelled' },
      }),
    ]);

    // Aggregations
    const byDay = new Map<string, { revenue: number; orders: number }>();
    const byHour = new Map<number, { revenue: number; orders: number }>();
    const byProduct = new Map<string, { quantity: number; revenue: number }>();
    const byChannel = new Map<string, { revenue: number; orders: number; deliveryFee: number }>();
    const byPayment = new Map<string, { revenue: number; orders: number }>();

    let totalDeliveryTimeMs = 0;
    let deliveryTimeCount = 0;

    for (const o of orders) {
      const revenue = Number(o.total);

      // By day
      const dayKey = (o.createdAt as Date).toISOString().slice(0, 10);
      const day = byDay.get(dayKey) ?? { revenue: 0, orders: 0 };
      day.revenue += revenue; day.orders++;
      byDay.set(dayKey, day);

      // By hour
      const hour = (o.createdAt as Date).getHours();
      const hr = byHour.get(hour) ?? { revenue: 0, orders: 0 };
      hr.revenue += revenue; hr.orders++;
      byHour.set(hour, hr);

      // By channel
      const ch = (o.channel === 'dine_in' ? 'dine-in' : o.channel) || 'dine-in';
      const chAgg = byChannel.get(ch) ?? { revenue: 0, orders: 0, deliveryFee: 0 };
      chAgg.revenue += revenue;
      chAgg.orders++;
      chAgg.deliveryFee += Number(o.deliveryFee ?? 0);
      byChannel.set(ch, chAgg);

      // By payment
      const pm = o.paymentMethod || 'Não informado';
      const pmAgg = byPayment.get(pm) ?? { revenue: 0, orders: 0 };
      pmAgg.revenue += revenue; pmAgg.orders++;
      byPayment.set(pm, pmAgg);

      // Products
      for (const it of o.items) {
        const p = byProduct.get(it.name) ?? { quantity: 0, revenue: 0 };
        p.quantity += it.quantity; p.revenue += Number(it.totalPrice);
        byProduct.set(it.name, p);
      }

      // Delivery time (accepted → delivered)
      if (o.channel === 'delivery' && o.acceptedAt && o.deliveredAt) {
        totalDeliveryTimeMs += (o.deliveredAt as Date).getTime() - (o.acceptedAt as Date).getTime();
        deliveryTimeCount++;
      }
    }

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const totalOrders = orders.length;

    return ok({
      period: { from: since, to: new Date(), days },
      totals: {
        orders: totalOrders,
        revenue: totalRevenue,
        avgTicket: totalOrders ? totalRevenue / totalOrders : 0,
        cancelled: cancelledOrders,
        cancellationRate: (totalOrders + cancelledOrders) > 0
          ? (cancelledOrders / (totalOrders + cancelledOrders)) * 100
          : 0,
      },
      byChannel: Array.from(byChannel.entries()).map(([channel, v]) => ({
        channel,
        label: channel === 'dine-in' ? 'Mesa' : channel === 'delivery' ? 'Delivery' : 'iFood',
        ...v,
        avgTicket: v.orders ? v.revenue / v.orders : 0,
        pct: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0,
      })).sort((a, b) => b.revenue - a.revenue),
      byPayment: Array.from(byPayment.entries()).map(([method, v]) => ({
        method,
        ...v,
        pct: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0,
      })).sort((a, b) => b.revenue - a.revenue),
      byDay: Array.from(byDay.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byHour: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, '0')}h`,
        ...(byHour.get(h) ?? { revenue: 0, orders: 0 }),
      })),
      topProducts: Array.from(byProduct.entries())
        .map(([name, v]) => ({ name, ...v, pct: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      deliveryMetrics: {
        avgTimeMin: deliveryTimeCount ? Math.round(totalDeliveryTimeMs / deliveryTimeCount / 60000) : null,
        count: deliveryTimeCount,
      },
    });
  } catch (e) { return serverError(e); }
}
