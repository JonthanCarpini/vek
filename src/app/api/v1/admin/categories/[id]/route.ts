import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, notFound, parseBody, serverError } from '@/lib/api';
import { categorySchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, categorySchema.partial());
    if (!p.ok) return p.res;
    const cat = await prisma.category.update({ where: { id }, data: p.data as any });
    return ok({ category: cat });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      await prisma.category.update({ where: { id }, data: { active: false } });
      return ok({ archived: true });
    }
    await prisma.category.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) { return serverError(e); }
}
