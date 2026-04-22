import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getStoreState } from '@/lib/store';

/**
 * GET /api/v1/delivery/[slug]/info
 * Retorna dados públicos da unidade para a home do delivery.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const unit = await prisma.unit.findUnique({
      where: { slug } as any,
      select: {
        id: true, name: true, logoUrl: true, primaryColor: true,
        address: true, phone: true, whatsapp: true, instagram: true,
        deliveryEnabled: true, takeoutEnabled: true,
        deliveryMinOrder: true, deliveryMaxRadiusKm: true,
        deliveryBaseFee: true, deliveryFeePerKm: true, deliveryFreeOver: true,
        deliveryPrepTimeMin: true, deliveryAvgTimeMin: true,
        addressLat: true, addressLng: true,
        paymentMethods: true,
      } as any,
    }) as any;
    if (!unit) return fail('Loja não encontrada', 404);
    if (!unit.deliveryEnabled && !unit.takeoutEnabled) {
      return fail('Loja não faz delivery nem retirada', 400);
    }

    const state = await getStoreState(unit.id);

    return ok({
      id: unit.id,
      name: unit.name,
      logoUrl: unit.logoUrl,
      primaryColor: unit.primaryColor,
      address: unit.address,
      phone: unit.phone,
      whatsapp: unit.whatsapp,
      instagram: unit.instagram,
      deliveryEnabled: unit.deliveryEnabled,
      takeoutEnabled: unit.takeoutEnabled,
      deliveryMinOrder: Number(unit.deliveryMinOrder),
      deliveryMaxRadiusKm: Number(unit.deliveryMaxRadiusKm),
      deliveryBaseFee: Number(unit.deliveryBaseFee),
      deliveryFeePerKm: Number(unit.deliveryFeePerKm),
      deliveryFreeOver: unit.deliveryFreeOver ? Number(unit.deliveryFreeOver) : null,
      deliveryPrepTimeMin: unit.deliveryPrepTimeMin,
      deliveryAvgTimeMin: unit.deliveryAvgTimeMin,
      origin: unit.addressLat && unit.addressLng
        ? { lat: Number(unit.addressLat), lng: Number(unit.addressLng) }
        : null,
      paymentMethods: unit.paymentMethods ? unit.paymentMethods.split(',').map((m: string) => m.trim()) : ['cash'],
      state,
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
