import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { createOrderFromItems } from '@/lib/orders';
import { z } from 'zod';

const waiterCreateOrderSchema = z.object({
  sessionId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(200).optional().nullable(),
  })).min(1).max(50),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/v1/waiter/orders
 * Garcom cria um pedido em nome de uma sessao ativa.
 */
export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuario sem unidade', 400);

    const parsed = await parseBody(req, waiterCreateOrderSchema);
    if (!parsed.ok) return parsed.res;

    const session = await prisma.tableSession.findUnique({
      where: { id: parsed.data.sessionId },
    });
    if (!session || session.unitId !== g.staff.unitId) return fail('Sessao nao encontrada', 404);
    if (session.status !== 'active') return fail('Sessao nao esta ativa', 409);

    const result = await createOrderFromItems({
      unitId: g.staff.unitId,
      sessionId: session.id,
      tableId: session.tableId,
      items: parsed.data.items,
      notes: parsed.data.notes || null,
    });
    if (!result.ok) return fail(result.message, result.status);
    return ok({ order: result.order });
  } catch (e) { return serverError(e); }
}
