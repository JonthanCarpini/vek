import { NextRequest } from 'next/server';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { cancelOrder } from '@/lib/orders';

/**
 * POST /api/v1/waiter/orders/[id]/cancel
 * Cancela o pedido inteiro. Restitui estoque.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuario sem unidade', 400);
    const { id } = await params;
    let reason: string | undefined;
    try { const body = await req.json(); reason = body?.reason; } catch {}
    const result = await cancelOrder({ orderId: id, unitId: g.staff.unitId, reason });
    if (!result.ok) return fail(result.message, result.status);
    return ok({ order: result.order });
  } catch (e) { return serverError(e); }
}
