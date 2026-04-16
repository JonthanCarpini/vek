import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { categorySchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const cats = await prisma.category.findMany({
      where: { unitId }, orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return ok({ categories: cats });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const p = await parseBody(req, categorySchema);
    if (!p.ok) return p.res;
    const cat = await prisma.category.create({ data: { ...p.data, unitId } });
    return ok({ category: cat });
  } catch (e) { return serverError(e); }
}
