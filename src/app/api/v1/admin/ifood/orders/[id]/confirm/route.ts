import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { confirmIfoodOrder } from '@/lib/ifood/actions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const order = await confirmIfoodOrder(id);
    return ok({ order });
  } catch (e: any) {
    if (e?.message?.includes('não pertence') || e?.message?.includes('não encontrado')) {
      return fail(e.message, 400);
    }
    return serverError(e);
  }
}
