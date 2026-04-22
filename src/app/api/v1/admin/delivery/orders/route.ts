import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/guard';

/**
 * GET /api/v1/admin/delivery/orders
 * Lista pedidos de delivery/takeout da unidade.
 * Query: ?status=active|all&limit=50
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager', 'cashier']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade associada', 400);

    const status = req.nextUrl.searchParams.get('status') || 'active';
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 200);

    const where: any = {
      unitId: g.staff.unitId,
      channel: 'delivery',
    };
    if (status === 'active') {
      where.status = { in: ['received', 'accepted', 'preparing', 'ready', 'dispatched'] };
    } else if (status !== 'all') {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        items: { select: { id: true, name: true, quantity: true, totalPrice: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    }) as any[];

    // Contadores por status
    const counts = await prisma.order.groupBy({
      by: ['status'],
      where: { unitId: g.staff.unitId, channel: 'delivery' },
      _count: true,
    });

    return ok({
      orders: orders.map((o: any) => ({
        id: o.id,
        sequenceNumber: o.sequenceNumber,
        status: o.status,
        orderType: o.orderType,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        total: Number(o.total),
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        changeFor: o.changeFor ? Number(o.changeFor) : null,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryAddress: o.deliveryAddress,
        distanceKm: o.distanceKm ? Number(o.distanceKm) : null,
        notes: o.notes,
        estimatedDeliveryAt: o.estimatedDeliveryAt,
        createdAt: o.createdAt,
        dispatchedAt: o.dispatchedAt,
        deliveredAt: o.deliveredAt,
        driver: o.driver,
        items: o.items.map((i: any) => ({
          id: i.id, name: i.name, quantity: i.quantity, totalPrice: Number(i.totalPrice),
        })),
      })),
      counts: Object.fromEntries(counts.map((c: any) => [c.status, c._count])),
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
