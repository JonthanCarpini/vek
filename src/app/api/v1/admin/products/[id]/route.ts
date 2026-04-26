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
    const { ingredients: _ing, ...rest } = p.data as any;
    const product = await prisma.product.update({
      where: { id },
      data: rest,
      include: { category: { select: { name: true } } },
    });
    return ok({ product });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get('hard') === 'true';

    if (hard) {
      await prisma.product.delete({ where: { id } });
      return ok({ deleted: true });
    }

    await prisma.product.update({ where: { id }, data: { active: false, available: false } });
    return ok({ archived: true });
  } catch (e) { return serverError(e); }
}
