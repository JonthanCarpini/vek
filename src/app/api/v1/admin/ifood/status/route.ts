import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import {
  refreshMerchantStatus,
  pauseMerchant,
  resumeMerchant,
  listInterruptions,
} from '@/lib/ifood/merchant';
import { z } from 'zod';

// GET: atualiza e retorna status da loja + interrupções ativas
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return fail('Sem unidade associada', 400);

    const [{ status, details }, interruptions] = await Promise.all([
      refreshMerchantStatus(unitId),
      listInterruptions(unitId).catch(() => []),
    ]);
    return ok({ status, details, interruptions });
  } catch (e: any) {
    if (e?.message?.includes('merchantId')) return fail(e.message, 400);
    return serverError(e);
  }
}

// POST: pausar ou retomar a loja
const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pause'),
    durationMinutes: z.number().int().min(5).max(1440),
    description: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal('resume'),
    interruptionId: z.string().min(1),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return fail('Sem unidade associada', 400);

    const p = await parseBody(req, actionSchema);
    if (!p.ok) return p.res;

    if (p.data.action === 'pause') {
      const result = await pauseMerchant(unitId, p.data.durationMinutes, p.data.description);
      return ok({ result });
    }
    const result = await resumeMerchant(unitId, p.data.interruptionId);
    return ok({ result });
  } catch (e: any) {
    if (e?.message?.includes('merchantId')) return fail(e.message, 400);
    return serverError(e);
  }
}
