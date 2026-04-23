import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/delivery/menu
 * Cardápio público da unidade ativa (apenas categorias/produtos ativos).
 */
export async function GET(_req: NextRequest) {
  try {
    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { id: true } as any,
    }) as any;
    if (!unit) return fail('Loja não encontrada', 404);

    const categories = await prisma.category.findMany({
      where: { unitId: unit.id, active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return ok({
      categories: categories
        .filter((c) => c.products.length > 0)
        .map((c) => ({
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
            featured: p.featured,
          })),
        })),
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
