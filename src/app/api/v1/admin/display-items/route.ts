import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { displayItemSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const items = await prisma.displayItem.findMany({
      where: { unitId: g.staff.unitId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return ok({ items });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const p = await parseBody(req, displayItemSchema);
    if (!p.ok) return p.res;
    const item = await prisma.displayItem.create({
      data: {
        unitId: g.staff.unitId,
        type: p.data.type,
        url: p.data.url,
        durationSec: p.data.durationSec ?? 8,
        sortOrder: p.data.sortOrder ?? 0,
        active: p.data.active ?? true,
        title: p.data.title || null,
        subtitle: p.data.subtitle || null,
      },
    });
    return ok({ item });
  } catch (e) { return serverError(e); }
}
