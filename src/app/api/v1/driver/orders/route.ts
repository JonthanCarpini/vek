import { NextRequest } from 'next/server';
import { ok, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/guard';

/**
 * GET /api/v1/driver/orders
 * Lista pedidos atribuídos ao motoboy logado.
 * Query: ?status=active|history (default: active)
 *   active  → status in [ready, dispatched]
 *   history → últimos 30 entregues/cancelados
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireDriver(req);
    if (!g.ok) return g.res;

    const status = req.nextUrl.searchParams.get('status') || 'active';
    const where: any = {
      driverId: g.driver.sub,
      channel: 'delivery',
    };

    if (status === 'active') {
      where.status = { in: ['ready', 'dispatched'] };
    } else {
      where.status = { in: ['delivered', 'cancelled'] };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: status === 'active'
        ? [{ createdAt: 'asc' }]
        : [{ deliveredAt: 'desc' }, { createdAt: 'desc' }],
      take: status === 'history' ? 30 : 100,
      include: {
        items: { select: { quantity: true, name: true } },
      } as any,
    }) as any[];

    return ok({
      orders: orders.map((o) => ({
        id: o.id,
        sequenceNumber: o.sequenceNumber,
        status: o.status,
        orderType: o.orderType,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryAddress: o.deliveryAddress,
        // Prisma Decimal serializa como string no JSON → normalizamos para
        // number aqui para que o cliente consiga usar .toFixed diretamente.
        deliveryLat: o.deliveryLat != null ? Number(o.deliveryLat) : null,
        deliveryLng: o.deliveryLng != null ? Number(o.deliveryLng) : null,
        distanceKm: o.distanceKm != null ? Number(o.distanceKm) : null,
        subtotal: Number(o.subtotal ?? 0),
        deliveryFee: Number(o.deliveryFee ?? 0),
        total: Number(o.total ?? 0),
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        changeFor: o.changeFor != null ? Number(o.changeFor) : null,
        notes: o.notes,
        itemsCount: o.items.reduce((s: number, i: any) => s + i.quantity, 0),
        items: o.items,
        createdAt: o.createdAt,
        readyAt: o.readyAt,
        dispatchedAt: o.dispatchedAt,
        deliveredAt: o.deliveredAt,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
