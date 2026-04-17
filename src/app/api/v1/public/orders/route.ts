import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, unauthorized } from '@/lib/api';
import { createOrderSchema } from '@/lib/validators';
import { getSessionFromRequest } from '@/lib/auth';
import { createOrderFromItems, serializeOrder } from '@/lib/orders';

export async function GET(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const orders = await prisma.order.findMany({
      where: { sessionId: s.sid },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return ok({ orders: orders.map(serializeOrder) });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const parsed = await parseBody(req, createOrderSchema);
    if (!parsed.ok) return parsed.res;
    const result = await createOrderFromItems({
      unitId: s.uid,
      sessionId: s.sid,
      tableId: s.tid,
      items: parsed.data.items,
      notes: parsed.data.notes || null,
    });
    if (!result.ok) return fail(result.message, result.status);
    return ok({ order: result.order });
  } catch (e) { return serverError(e); }
}
