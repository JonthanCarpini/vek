import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { openStoreDaySchema } from '@/lib/validators';
import { getCurrentStoreDay } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const current = await getCurrentStoreDay(g.staff.unitId);
    const history = await prisma.storeDay.findMany({
      where: { unitId: g.staff.unitId },
      orderBy: { openedAt: 'desc' },
      take: 30,
    });
    return ok({ current, history });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const existing = await getCurrentStoreDay(g.staff.unitId);
    if (existing) return fail('Já existe caixa aberto', 409);
    const p = await parseBody(req, openStoreDaySchema);
    if (!p.ok) return p.res;
    const day = await prisma.storeDay.create({
      data: {
        unitId: g.staff.unitId,
        openedByUserId: g.staff.sub,
        openingCash: p.data.openingCash,
        notes: p.data.notes,
      },
    });
    return ok({ day });
  } catch (e) { return serverError(e); }
}
