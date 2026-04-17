import { NextRequest } from 'next/server';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { addItemsToOrder } from '@/lib/orders';
import { z } from 'zod';

const addItemsSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(200).optional().nullable(),
  })).min(1).max(50),
});

/**
 * POST /api/v1/waiter/orders/[id]/items
 * Adiciona novos itens a um pedido existente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuario sem unidade', 400);
    const { id } = await params;
    const parsed = await parseBody(req, addItemsSchema);
    if (!parsed.ok) return parsed.res;
    const result = await addItemsToOrder({
      orderId: id, unitId: g.staff.unitId, items: parsed.data.items,
    });
    if (!result.ok) return fail(result.message, result.status);
    return ok({ order: result.order });
  } catch (e) { return serverError(e); }
}
