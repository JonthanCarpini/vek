import { NextRequest } from 'next/server';
import { ok, serverError, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireCustomer } from '@/lib/guard';
import { geocodeAddress, GeocodeError } from '@/lib/delivery/geocoding';
import { z } from 'zod';

/**
 * GET /api/v1/delivery/addresses
 * Lista endereços salvos do cliente autenticado.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireCustomer(req);
    if (!g.ok) return g.res;

    const addresses = await (prisma as any).deliveryAddress.findMany({
      where: { customerId: g.customer.sub },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return ok({
      addresses: addresses.map((a: any) => ({
        id: a.id,
        label: a.label,
        street: a.street,
        number: a.number,
        complement: a.complement,
        reference: a.reference,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        zipCode: a.zipCode,
        lat: a.lat ? Number(a.lat) : null,
        lng: a.lng ? Number(a.lng) : null,
        isDefault: a.isDefault,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

const createSchema = z.object({
  label: z.string().trim().min(1).max(30).default('Casa'),
  street: z.string().trim().min(2).max(200),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(100).optional(),
  reference: z.string().trim().max(200).optional(),
  neighborhood: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().max(50).default(''),
  zipCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().optional(),
  // Se lat/lng forem enviados, não precisamos geocodificar
  lat: z.number().optional(),
  lng: z.number().optional(),
});

/**
 * POST /api/v1/delivery/addresses
 * Cria endereço para o cliente autenticado. Geocodifica se lat/lng não fornecidos.
 */
export async function POST(req: NextRequest) {
  try {
    const g = requireCustomer(req);
    if (!g.ok) return g.res;

    const p = await parseBody(req, createSchema);
    if (!p.ok) return p.res;
    const data = p.data;

    // Geocodifica se não tiver lat/lng
    let lat = data.lat;
    let lng = data.lng;
    if (lat == null || lng == null) {
      const fullAddress = [
        `${data.street}, ${data.number}`,
        data.neighborhood,
        data.city,
        data.state,
        data.zipCode,
        'Brasil',
      ].filter(Boolean).join(', ');

      try {
        const geo = await geocodeAddress({ unitId: g.customer.uid, address: fullAddress });
        lat = geo.lat;
        lng = geo.lng;
      } catch (err: any) {
        // Se geocoding falhar, ainda salvamos (sem lat/lng) mas o pedido pode exigir
        if (!(err instanceof GeocodeError)) throw err;
      }
    }

    // Se isDefault, desmarca os outros
    if (data.isDefault) {
      await (prisma as any).deliveryAddress.updateMany({
        where: { customerId: g.customer.sub, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await (prisma as any).deliveryAddress.create({
      data: {
        unitId: g.customer.uid,
        customerId: g.customer.sub,
        label: data.label,
        street: data.street,
        number: data.number,
        complement: data.complement,
        reference: data.reference,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        lat,
        lng,
        isDefault: !!data.isDefault,
      },
    });

    return ok({
      id: address.id,
      lat: address.lat ? Number(address.lat) : null,
      lng: address.lng ? Number(address.lng) : null,
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
