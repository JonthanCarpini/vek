import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { requireStaff } from '@/lib/guard';
import { updateDeliveryOrderStatus } from '@/lib/delivery/status';
import { z } from 'zod';

/**
 * POST /api/v1/admin/delivery/orders/[id]/status
 * Body: { status }
 * Valores permitidos: accepted, preparing, ready, dispatched, delivered, cancelled
 */
const schema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager', 'cashier']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade associada', 400);

    const { id } = await params;
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const result = await updateDeliveryOrderStatus({
      orderId: id,
      status: p.data.status,
      reason: p.data.reason,
      expectedUnitId: g.staff.unitId,
    });
    if (!result.ok) return fail(result.error, result.status);

    return ok({
      ok: true,
      order: {
        id: result.order.id,
        sequenceNumber: result.order.sequenceNumber,
        status: result.order.status,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
