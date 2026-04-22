import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/guard';
import { z } from 'zod';

/**
 * GET /api/v1/admin/delivery
 * Retorna a configuração de delivery da unidade do staff autenticado.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade associada', 400);

    const unit = await prisma.unit.findUnique({
      where: { id: g.staff.unitId },
      select: {
        id: true, name: true, slug: true,
        deliveryEnabled: true, takeoutEnabled: true,
        deliveryMinOrder: true, deliveryMaxRadiusKm: true,
        deliveryBaseFee: true, deliveryFeePerKm: true, deliveryFreeOver: true,
        deliveryPrepTimeMin: true, deliveryAvgTimeMin: true,
        addressLat: true, addressLng: true,
        googleMapsApiKey: true,
        address: true,
      } as any,
    }) as any;
    if (!unit) return fail('Unidade não encontrada', 404);

    return ok({
      id: unit.id,
      name: unit.name,
      slug: unit.slug,
      deliveryEnabled: unit.deliveryEnabled,
      takeoutEnabled: unit.takeoutEnabled,
      deliveryMinOrder: Number(unit.deliveryMinOrder),
      deliveryMaxRadiusKm: Number(unit.deliveryMaxRadiusKm),
      deliveryBaseFee: Number(unit.deliveryBaseFee),
      deliveryFeePerKm: Number(unit.deliveryFeePerKm),
      deliveryFreeOver: unit.deliveryFreeOver ? Number(unit.deliveryFreeOver) : null,
      deliveryPrepTimeMin: unit.deliveryPrepTimeMin,
      deliveryAvgTimeMin: unit.deliveryAvgTimeMin,
      addressLat: unit.addressLat ? Number(unit.addressLat) : null,
      addressLng: unit.addressLng ? Number(unit.addressLng) : null,
      hasGoogleMapsKey: !!unit.googleMapsApiKey,
      address: unit.address,
    });
  } catch (e) {
    return serverError(e);
  }
}

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const updateSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRegex, 'Slug inválido (apenas a-z, 0-9, -)').min(2).max(80).optional(),
  deliveryEnabled: z.boolean().optional(),
  takeoutEnabled: z.boolean().optional(),
  deliveryMinOrder: z.number().min(0).optional(),
  deliveryMaxRadiusKm: z.number().min(0.5).max(200).optional(),
  deliveryBaseFee: z.number().min(0).optional(),
  deliveryFeePerKm: z.number().min(0).optional(),
  deliveryFreeOver: z.number().min(0).nullable().optional(),
  deliveryPrepTimeMin: z.number().int().min(1).max(240).optional(),
  deliveryAvgTimeMin: z.number().int().min(1).max(240).optional(),
  addressLat: z.number().min(-90).max(90).nullable().optional(),
  addressLng: z.number().min(-180).max(180).nullable().optional(),
  googleMapsApiKey: z.string().trim().max(200).nullable().optional(),
});

/**
 * PATCH /api/v1/admin/delivery
 * Atualiza configuração de delivery.
 */
export async function PATCH(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade associada', 400);

    const p = await parseBody(req, updateSchema);
    if (!p.ok) return p.res;

    // Valida slug único
    if (p.data.slug) {
      const existing = await prisma.unit.findUnique({
        where: { slug: p.data.slug } as any,
      }) as any;
      if (existing && existing.id !== g.staff.unitId) {
        return fail('Slug já está em uso', 409);
      }
    }

    await prisma.unit.update({
      where: { id: g.staff.unitId },
      data: p.data as any,
    });

    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
