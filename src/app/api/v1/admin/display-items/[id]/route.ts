import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { displayItemSchema } from '@/lib/validators';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;
    const existing = await prisma.displayItem.findUnique({ where: { id } });
    if (!existing || existing.unitId !== g.staff.unitId) return notFound();
    const p = await parseBody(req, displayItemSchema.partial());
    if (!p.ok) return p.res;
    const item = await prisma.displayItem.update({ where: { id }, data: p.data as any });
    return ok({ item });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;
    const existing = await prisma.displayItem.findUnique({ where: { id } });
    if (!existing || existing.unitId !== g.staff.unitId) return notFound();
    await prisma.displayItem.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) { return serverError(e); }
}
