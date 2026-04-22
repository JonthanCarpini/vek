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

    const channelFilter = req.nextUrl.searchParams.get('channel'); // dine_in | ifood | delivery | null

    const orders = await prisma.order.findMany({
      where: {
        unitId,
        createdAt: { gte: since },
        status: { not: 'cancelled' },
        ...(channelFilter ? ({ channel: channelFilter } as any) : {}),
      },
      select: {
        total: true,
        createdAt: true,
        items: { select: { name: true, quantity: true, totalPrice: true } },
        ...( { channel: true } as any ),
      } as any,
    });

    const byDay = new Map<string, { revenue: number; orders: number }>();
    const byProduct = new Map<string, { quantity: number; revenue: number }>();
    const byChannel = new Map<string, { revenue: number; orders: number }>();

    for (const o of orders as any[]) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const day = byDay.get(key) ?? { revenue: 0, orders: 0 };
      day.revenue += Number(o.total); day.orders += 1;
      byDay.set(key, day);

      const ch = o.channel || 'dine_in';
      const chAgg = byChannel.get(ch) ?? { revenue: 0, orders: 0 };
      chAgg.revenue += Number(o.total); chAgg.orders += 1;
      byChannel.set(ch, chAgg);

      for (const it of o.items) {
        const p = byProduct.get(it.name) ?? { quantity: 0, revenue: 0 };
        p.quantity += it.quantity; p.revenue += Number(it.totalPrice);
        byProduct.set(it.name, p);
      }
    }

    return ok({
      period: { from: since, to: new Date() },
      byDay: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      byChannel: Array.from(byChannel.entries()).map(([channel, v]) => ({ channel, ...v })),
      topProducts: Array.from(byProduct.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      totals: {
        orders: orders.length,
        revenue: orders.reduce((s: number, o: any) => s + Number(o.total), 0),
      },
    });
  } catch (e) { return serverError(e); }
}
