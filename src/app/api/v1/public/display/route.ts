import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/api';

export async function GET(_req: NextRequest) {
  try {
    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { id: true, name: true, logoUrl: true, primaryColor: true, whatsapp: true, address: true },
    });
    if (!unit) return ok({ unit: null, orders: [], featured: [] });

    const [orders, featured] = await Promise.all([
      prisma.order.findMany({
        where: {
          unitId: unit.id,
          status: { in: ['received', 'accepted', 'preparing', 'ready'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true, sequenceNumber: true, status: true, createdAt: true,
          table: { select: { number: true } },
        },
      }),
      prisma.product.findMany({
        where: { unitId: unit.id, active: true, available: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true, name: true, description: true, price: true, imageUrl: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    return ok({ unit, orders, featured });
  } catch (e) { return serverError(e); }
}
