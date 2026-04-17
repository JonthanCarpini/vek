import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const q = req.nextUrl.searchParams.get('q')?.trim() || '';
    const where: any = { unitId: g.staff.unitId };
    if (q) {
      where.OR = [
        { phone: { contains: q } },
        { name: { contains: q } },
      ];
    }
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      take: 200,
    });
    return ok({
      customers: customers.map((c: any) => ({
        ...c,
        totalSpent: Number(c.totalSpent),
        avgTicket: c.totalOrders > 0 ? Number(c.totalSpent) / c.totalOrders : 0,
      })),
    });
  } catch (e) { return serverError(e); }
}
