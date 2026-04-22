import { NextRequest } from 'next/server';
import { ok, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return ok({ orders: [] });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    const orders = await prisma.order.findMany({
      where: {
        unitId,
        channel: 'ifood',
        ...(status ? { status } : {}),
      } as any,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return ok({
      orders: orders.map((o: any) => ({
        id: o.id,
        sequenceNumber: o.sequenceNumber,
        ifoodOrderId: o.ifoodOrderId,
        ifoodDisplayId: o.ifoodDisplayId,
        ifoodStatus: o.ifoodStatus,
        status: o.status,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryAddress: o.deliveryAddress,
        subtotal: Number(o.subtotal),
        total: Number(o.total),
        notes: o.notes,
        createdAt: o.createdAt,
        acceptedAt: o.acceptedAt,
        readyAt: o.readyAt,
        deliveredAt: o.deliveredAt,
        items: o.items.map((i: any) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          notes: i.notes,
        })),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
