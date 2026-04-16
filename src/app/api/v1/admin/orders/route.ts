import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const status = req.nextUrl.searchParams.get('status');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10), 500);
    const orders = await prisma.order.findMany({
      where: { unitId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: true, table: { select: { number: true, label: true } }, session: { select: { customerName: true } } },
    });
    return ok({ orders });
  } catch (e) { return serverError(e); }
}
