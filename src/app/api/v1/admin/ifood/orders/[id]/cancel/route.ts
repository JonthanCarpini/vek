import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { requestIfoodCancellation, listIfoodCancellationReasons } from '@/lib/ifood/actions';
import { z } from 'zod';

const cancelSchema = z.object({
  reason: z.string().min(3).max(500),
  cancellationCode: z.string().min(1).max(10),
});

// Lista motivos válidos de cancelamento
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const reasons = await listIfoodCancellationReasons(id);
    return ok({ reasons });
  } catch (e: any) {
    if (e?.message?.includes('não pertence') || e?.message?.includes('não encontrado')) {
      return fail(e.message, 400);
    }
    return serverError(e);
  }
}

// Solicita cancelamento
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const p = await parseBody(req, cancelSchema);
    if (!p.ok) return p.res;
    const { id } = await params;
    const order = await requestIfoodCancellation(id, p.data.reason, p.data.cancellationCode);
    return ok({ order });
  } catch (e: any) {
    if (e?.message?.includes('não pertence') || e?.message?.includes('não encontrado')) {
      return fail(e.message, 400);
    }
    return serverError(e);
  }
}
