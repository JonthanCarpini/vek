import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/guard';
import { emitToDashboard, emitToDriver, SocketEvents } from '@/lib/socket';
import { z } from 'zod';

/**
 * POST /api/v1/admin/delivery/orders/[id]/assign-driver
 * Body: { driverId: string | null }  (null = desatribui)
 */
const schema = z.object({
  driverId: z.string().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager', 'cashier']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade associada', 400);

    const { id } = await params;
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const order = await prisma.order.findUnique({ where: { id } }) as any;
    if (!order || order.unitId !== g.staff.unitId) return fail('Pedido não encontrado', 404);
    if (order.channel !== 'delivery') return fail('Pedido não é de delivery', 400);
    if (order.orderType !== 'delivery') return fail('Pedido é retirada, não entrega', 400);

    const previousDriverId = order.driverId as string | null;

    if (p.data.driverId) {
      const driver = await (prisma as any).driver.findUnique({ where: { id: p.data.driverId } });
      if (!driver || driver.unitId !== g.staff.unitId || !driver.active) {
        return fail('Motoboy inválido', 400);
      }
    }

    await prisma.order.update({
      where: { id },
      data: { driverId: p.data.driverId } as any,
    });

    emitToDashboard(g.staff.unitId, SocketEvents.ORDER_UPDATED, {
      id, driverId: p.data.driverId,
    });

    if (previousDriverId && previousDriverId !== p.data.driverId) {
      emitToDriver(previousDriverId, SocketEvents.ORDER_UNASSIGNED, { orderId: id });
    }
    if (p.data.driverId) {
      emitToDriver(p.data.driverId, SocketEvents.ORDER_ASSIGNED, {
        orderId: id,
        sequenceNumber: order.sequenceNumber,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        total: Number(order.total),
        status: order.status,
      });
    }

    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
