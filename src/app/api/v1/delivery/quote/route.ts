import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { geocodeAddress, GeocodeError } from '@/lib/delivery/geocoding';
import { calculateDeliveryFee } from '@/lib/delivery/pricing';
import { z } from 'zod';

/**
 * POST /api/v1/delivery/quote
 * Body: { address | lat+lng, orderSubtotal? }
 */
const schema = z.object({
  address: z.string().trim().min(5).max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  orderSubtotal: z.number().min(0).optional(),
}).refine(
  (d) => !!d.address || (typeof d.lat === 'number' && typeof d.lng === 'number'),
  'Informe address ou lat+lng',
);

export async function POST(req: NextRequest) {
  try {
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: {
        id: true, deliveryEnabled: true, deliveryMinOrder: true,
        addressLat: true, addressLng: true,
      } as any,
    }) as any;
    if (!unit) return fail('Loja não encontrada', 404);
    if (!unit.deliveryEnabled) return fail('Delivery indisponível', 400);
    if (!unit.addressLat || !unit.addressLng) {
      return fail('Loja sem endereço configurado', 503);
    }

    let lat = p.data.lat;
    let lng = p.data.lng;
    let formatted: string | undefined;

    if ((lat == null || lng == null) && p.data.address) {
      try {
        const geo = await geocodeAddress({ unitId: unit.id, address: p.data.address });
        lat = geo.lat;
        lng = geo.lng;
        formatted = geo.formatted;
      } catch (e: any) {
        if (e instanceof GeocodeError) return fail(e.message, 400);
        throw e;
      }
    }

    const quote = await calculateDeliveryFee({
      unitId: unit.id,
      customerLat: lat!,
      customerLng: lng!,
      orderSubtotal: p.data.orderSubtotal,
    });

    return ok({
      ...quote,
      lat,
      lng,
      formatted,
      minOrder: Number(unit.deliveryMinOrder),
    });
  } catch (e: any) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
