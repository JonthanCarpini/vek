import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.WAITER);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const calls = await prisma.call.findMany({
      where: { unitId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        table: { select: { number: true, label: true } },
        session: { select: { customerName: true } },
      },
    });
    return ok({ calls });
  } catch (e) { return serverError(e); }
}
