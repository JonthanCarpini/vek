import { NextRequest } from 'next/server';
import { ok, serverError, notFound } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getStoreState } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const qrToken = url.searchParams.get('qrToken');
    let unitId = '';
    if (qrToken) {
      const t = await prisma.tableEntity.findUnique({ where: { qrToken }, select: { unitId: true } });
      if (!t) return notFound('Mesa não encontrada');
      unitId = t.unitId;
    } else {
      const unit = await prisma.unit.findFirst({ where: { active: true }, select: { id: true } });
      if (!unit) return notFound('Unidade não encontrada');
      unitId = unit.id;
    }
    const state = await getStoreState(unitId);
    return ok({ state });
  } catch (e) { return serverError(e); }
}
