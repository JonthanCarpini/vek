import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError } from '@/lib/api';
import { userSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';
import { hashPassword } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, userSchema.partial());
    if (!p.ok) return p.res;
    const d = p.data as any;
    const data: any = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.email !== undefined) data.email = d.email;
    if (d.role !== undefined) data.role = d.role;
    if (d.active !== undefined) data.active = d.active;
    if (d.password) data.passwordHash = await hashPassword(d.password);
    const user = await prisma.user.update({
      where: { id }, data,
      select: { id: true, name: true, email: true, role: true, active: true, unitId: true },
    });
    return ok({ user });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    await prisma.user.update({ where: { id }, data: { active: false } });
    return ok({ archived: true });
  } catch (e) { return serverError(e); }
}
