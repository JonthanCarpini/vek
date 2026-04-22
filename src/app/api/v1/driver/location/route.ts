import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/guard';
import { emitToDashboard, emitToOrderTracking, SocketEvents } from '@/lib/socket';
import { z } from 'zod';

const schema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

/**
 * PUT /api/v1/driver/location
 * O app do motoboy envia sua localização periodicamente (a cada 15-30s).
 * Gravamos na tabela e emitimos para os trackings dos pedidos ativos do motoboy.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = requireDriver(req);
    if (!g.ok) return g.res;

    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const now = new Date();
    await (prisma as any).driver.update({
      where: { id: g.driver.sub },
      data: {
        currentLat: p.data.lat,
        currentLng: p.data.lng,
        lastLocationAt: now,
      },
    });

    const activeOrders = await prisma.order.findMany({
      where: {
        driverId: g.driver.sub,
        channel: 'delivery',
        status: 'dispatched',
      },
      select: { id: true, unitId: true },
    });

    const payload = { driverId: g.driver.sub, lat: p.data.lat, lng: p.data.lng, at: now };
    for (const o of activeOrders) {
      emitToOrderTracking(o.id, SocketEvents.DRIVER_LOCATION, { ...payload, orderId: o.id });
      emitToDashboard(o.unitId, SocketEvents.DRIVER_LOCATION, { ...payload, orderId: o.id });
    }

    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
