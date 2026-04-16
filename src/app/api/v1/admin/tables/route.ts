import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { tableSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const tables = await prisma.tableEntity.findMany({
      where: { unitId },
      orderBy: { number: 'asc' },
      include: {
        sessions: {
          where: { status: 'active' },
          select: { id: true, customerName: true, openedAt: true, totalAmount: true },
          take: 1,
        },
      },
    });
    return ok({ tables });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);
    const p = await parseBody(req, tableSchema);
    if (!p.ok) return p.res;
    const qrToken = randomBytes(18).toString('base64url');
    const data = p.data as any;
    const table = await prisma.tableEntity.create({
      data: { unitId, number: data.number, label: data.label ?? null, capacity: data.capacity ?? 4, qrToken },
    });
    return ok({ table });
  } catch (e) { return serverError(e); }
}
