import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { userSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';
import { hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    const users = await prisma.user.findMany({
      where: unitId ? { unitId } : {},
      select: { id: true, name: true, email: true, role: true, unitId: true, active: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return ok({ users });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const p = await parseBody(req, userSchema);
    if (!p.ok) return p.res;
    const data = p.data as any;
    if (!data.password) return fail('Senha obrigatória', 422);
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        unitId, name: data.name, email: data.email, role: data.role,
        active: data.active ?? true, passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, active: true, unitId: true },
    });
    return ok({ user });
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('E-mail já cadastrado', 409);
    return serverError(e);
  }
}
