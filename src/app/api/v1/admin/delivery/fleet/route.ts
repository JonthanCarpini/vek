import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff, ROLES } from '@/lib/guard';

/**
 * GET /api/v1/admin/delivery/fleet
 * Dados para o mapa ao vivo da frota:
 *  - origin: coordenadas da loja
 *  - orders: pedidos em `dispatched` com driver posicionado
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade', 400);

    const unit = await prisma.unit.findUnique({
      where: { id: g.staff.unitId },
      select: { id: true, name: true, addressLat: true, addressLng: true } as any,
    }) as any;
    if (!unit) return fail('Unidade não encontrada', 404);

    const rawOrders = await prisma.order.findMany({
      where: {
        unitId: g.staff.unitId,
        channel: 'delivery',
        status: 'dispatched',
      },
      select: {
        id: true, sequenceNumber: true, customerName: true, customerPhone: true,
        deliveryAddress: true, customerLat: true, customerLng: true,
        dispatchedAt: true, estimatedDeliveryAt: true,
        driver: {
          select: {
            id: true, name: true, phone: true,
            currentLat: true, currentLng: true, lastLocationAt: true,
          } as any,
        },
      } as any,
    }) as any[];

    const orders = rawOrders
      .filter((o) =>
        o.driver &&
        o.driver.currentLat != null && o.driver.currentLng != null &&
        o.customerLat != null && o.customerLng != null,
      )
      .map((o) => ({
        id: o.id,
        sequenceNumber: o.sequenceNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryAddress: o.deliveryAddress,
        deliveryLat: Number(o.customerLat),
        deliveryLng: Number(o.customerLng),
        dispatchedAt: o.dispatchedAt,
        estimatedDeliveryAt: o.estimatedDeliveryAt,
        driver: {
          id: o.driver.id,
          name: o.driver.name,
          phone: o.driver.phone,
          currentLat: Number(o.driver.currentLat),
          currentLng: Number(o.driver.currentLng),
          lastLocationAt: o.driver.lastLocationAt,
        },
      }));

    return ok({
      origin: unit.addressLat && unit.addressLng
        ? { lat: Number(unit.addressLat), lng: Number(unit.addressLng), name: unit.name }
        : null,
      orders,
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
