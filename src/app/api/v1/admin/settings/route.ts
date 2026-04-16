import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { settingsSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const unit = await prisma.unit.findUnique({ where: { id: g.staff.unitId } });
    if (!unit) return fail('Unidade não encontrada', 404);
    return ok({ unit });
  } catch (e) { return serverError(e); }
}

export async function PUT(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const p = await parseBody(req, settingsSchema);
    if (!p.ok) return p.res;
    const unit = await prisma.unit.update({
      where: { id: g.staff.unitId },
      data: p.data,
    });
    return ok({ unit });
  } catch (e) { return serverError(e); }
}
