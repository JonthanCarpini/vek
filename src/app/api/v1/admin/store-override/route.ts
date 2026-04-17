import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { storeOverrideSchema } from '@/lib/validators';
import { getActiveOverride } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const active = await getActiveOverride(g.staff.unitId);
    const recent = await prisma.storeOverride.findMany({
      where: { unitId: g.staff.unitId },
      orderBy: { startsAt: 'desc' },
      take: 20,
    });
    return ok({ active, recent });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const p = await parseBody(req, storeOverrideSchema);
    if (!p.ok) return p.res;
    const override = await prisma.storeOverride.create({
      data: {
        unitId: g.staff.unitId,
        type: p.data.type,
        reason: p.data.reason,
        endsAt: p.data.endsAt ? new Date(p.data.endsAt) : null,
        createdByUserId: g.staff.sub,
      },
    });
    return ok({ override });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    // Encerra override ativo (endsAt = now)
    const active = await getActiveOverride(g.staff.unitId);
    if (!active) return ok({ cleared: false });
    await prisma.storeOverride.update({ where: { id: active.id }, data: { endsAt: new Date() } });
    return ok({ cleared: true });
  } catch (e) { return serverError(e); }
}
