import { NextRequest } from 'next/server';
import { ok, fail, serverError } from '@/lib/api';
import { getStoreState } from '@/lib/store';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const state = await getStoreState(g.staff.unitId);
    return ok({ state });
  } catch (e) { return serverError(e); }
}
