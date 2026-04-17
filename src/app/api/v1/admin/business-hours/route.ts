import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { businessHoursSchema } from '@/lib/validators';
import { invalidateStoreStateCache } from '@/lib/store';
import { emitToUnit, SocketEvents } from '@/lib/socket';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const hours = await prisma.businessHours.findMany({
      where: { unitId: g.staff.unitId },
      orderBy: { weekday: 'asc' },
    });
    return ok({ hours });
  } catch (e) { return serverError(e); }
}

export async function PUT(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const p = await parseBody(req, businessHoursSchema);
    if (!p.ok) return p.res;
    const unitId = g.staff.unitId;
    // Upsert por (unitId, weekday)
    await prisma.$transaction([
      prisma.businessHours.deleteMany({ where: { unitId } }),
      prisma.businessHours.createMany({
        data: p.data.hours.map((h: any) => ({ ...h, unitId })),
      }),
    ]);
    const hours = await prisma.businessHours.findMany({ where: { unitId }, orderBy: { weekday: 'asc' } });
    invalidateStoreStateCache(unitId);
    emitToUnit(unitId, SocketEvents.STORE_STATE_CHANGED, { reason: 'hours_changed' });
    return ok({ hours });
  } catch (e) { return serverError(e); }
}
