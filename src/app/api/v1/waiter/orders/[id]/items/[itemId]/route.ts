import { NextRequest } from 'next/server';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { cancelOrderItem } from '@/lib/orders';

/**
 * DELETE /api/v1/waiter/orders/[id]/items/[itemId]
 * Cancela um item individual de um pedido. Restitui estoque.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuario sem unidade', 400);
    const { itemId } = await params;
    const url = new URL(req.url);
    const reason = url.searchParams.get('reason') || undefined;
    const result = await cancelOrderItem({ itemId, unitId: g.staff.unitId, reason });
    if (!result.ok) return fail(result.message, result.status);
    return ok({ order: result.order });
  } catch (e) { return serverError(e); }
}
