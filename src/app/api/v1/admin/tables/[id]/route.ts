import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError } from '@/lib/api';
import { tableSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, tableSchema.partial());
    if (!p.ok) return p.res;
    const t = await prisma.tableEntity.update({ where: { id }, data: p.data as any });
    return ok({ table: t });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    await prisma.tableEntity.update({ where: { id }, data: { status: 'disabled' } });
    return ok({ disabled: true });
  } catch (e) { return serverError(e); }
}
