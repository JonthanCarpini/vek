import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError } from '@/lib/api';
import { productSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, productSchema.partial());
    if (!p.ok) return p.res;
    const { ingredients, ...rest } = p.data as any;
    const product = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.product.update({ where: { id }, data: rest });
      if (Array.isArray(ingredients)) {
        await tx.productIngredient.deleteMany({ where: { productId: id } });
        // Deduplica por ingredientId (mantém ultima ocorrencia somando quantidades)
        const dedup = new Map<string, { quantity: number; optional: boolean }>();
        for (const i of ingredients) {
          if (!i.ingredientId) continue;
          const prev = dedup.get(i.ingredientId);
          const qty = Number(i.quantity) || 0;
          if (qty <= 0) continue;
          if (prev) dedup.set(i.ingredientId, { quantity: prev.quantity + qty, optional: !!i.optional });
          else dedup.set(i.ingredientId, { quantity: qty, optional: !!i.optional });
        }
        if (dedup.size > 0) {
          await tx.productIngredient.createMany({
            data: Array.from(dedup.entries()).map(([ingredientId, v]) => ({
              productId: id, ingredientId, quantity: v.quantity, optional: v.optional,
            })),
          });
        }
      }
      return tx.product.findUnique({
        where: { id },
        include: { ingredients: { include: { ingredient: true } } },
      });
    });
    return ok({ product });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    await prisma.product.update({ where: { id }, data: { active: false, available: false } });
    return ok({ archived: true });
  } catch (e) { return serverError(e); }
}
