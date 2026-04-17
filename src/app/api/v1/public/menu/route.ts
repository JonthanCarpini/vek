import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError, unauthorized } from '@/lib/api';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    let unitId: string | null = session?.uid || req.nextUrl.searchParams.get('unitId');
    const qrToken = req.nextUrl.searchParams.get('qrToken');
    if (!unitId && qrToken) {
      const table = await prisma.tableEntity.findUnique({ where: { qrToken }, select: { unitId: true } });
      if (table) unitId = table.unitId;
    }
    if (!unitId) return unauthorized('Sessão, unitId ou qrToken necessário');

    const categories = await prisma.category.findMany({
      where: { unitId, active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            ingredients: {
              where: { ingredient: { active: true } },
              include: { ingredient: { select: { name: true } } },
            },
          },
        },
      },
    });

    return ok({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        products: c.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          imageUrl: p.imageUrl,
          available: p.available,
          preparationTimeMin: p.preparationTimeMin,
          tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          ingredients: p.ingredients.map((i) => i.ingredient.name),
        })),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
