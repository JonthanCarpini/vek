import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.KITCHEN);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const orders = await prisma.order.findMany({
      where: { unitId, status: { in: ['received', 'accepted', 'preparing', 'ready'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        items: true,
        table: { select: { number: true, label: true } },
        session: { select: { customerName: true } },
      },
    });
    return ok({ orders });
  } catch (e) { return serverError(e); }
}
