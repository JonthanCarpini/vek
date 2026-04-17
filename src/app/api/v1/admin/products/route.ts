import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { productSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const categoryId = req.nextUrl.searchParams.get('categoryId') || undefined;
    const activeParam = req.nextUrl.searchParams.get('active');
    const activeFilter = activeParam === 'true' ? { active: true } : activeParam === 'false' ? { active: false } : {};
    const products = await prisma.product.findMany({
      where: { unitId, ...(categoryId ? { categoryId } : {}), ...activeFilter },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { name: true } },
        ingredients: { include: { ingredient: true } },
      },
    });
    return ok({ products });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const p = await parseBody(req, productSchema);
    if (!p.ok) return p.res;
    const { ingredients, ...rest } = p.data as any;
    const dedup = new Map<string, { quantity: number; optional: boolean }>();
    if (Array.isArray(ingredients)) {
      for (const i of ingredients) {
        if (!i.ingredientId) continue;
        const qty = Number(i.quantity) || 0;
        if (qty <= 0) continue;
        const prev = dedup.get(i.ingredientId);
        if (prev) dedup.set(i.ingredientId, { quantity: prev.quantity + qty, optional: !!i.optional });
        else dedup.set(i.ingredientId, { quantity: qty, optional: !!i.optional });
      }
    }
    const product = await prisma.product.create({
      data: {
        ...rest,
        unitId,
        ...(dedup.size > 0
          ? { ingredients: { create: Array.from(dedup.entries()).map(([ingredientId, v]) => ({
              ingredientId, quantity: v.quantity, optional: v.optional,
            })) } }
          : {}),
      },
      include: { ingredients: { include: { ingredient: true } } },
    });
    return ok({ product });
  } catch (e) { return serverError(e); }
}
