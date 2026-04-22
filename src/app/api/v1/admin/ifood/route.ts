import { NextRequest } from 'next/server';
import { ok, serverError, parseBody } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { prisma } from '@/lib/prisma';
import { isIfoodConfigured } from '@/lib/ifood/client';
import { z } from 'zod';

// GET configuração + status atual
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return ok({ unit: null });

    const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
    if (!unit) return ok({ unit: null });

    // Contadores de pedidos iFood
    const [received, preparing, ready, delivered] = await Promise.all([
      prisma.order.count({ where: { unitId, channel: 'ifood', status: 'received' } as any }),
      prisma.order.count({ where: { unitId, channel: 'ifood', status: { in: ['accepted', 'preparing'] } } as any }),
      prisma.order.count({ where: { unitId, channel: 'ifood', status: 'ready' } as any }),
      prisma.order.count({ where: { unitId, channel: 'ifood', status: 'delivered' } as any }),
    ]);

    return ok({
      unit: {
        ifoodEnabled: !!unit.ifoodEnabled,
        ifoodMerchantId: unit.ifoodMerchantId || '',
        ifoodAutoConfirm: !!unit.ifoodAutoConfirm,
        ifoodStoreStatus: unit.ifoodStoreStatus || 'unknown',
        ifoodLastPollAt: unit.ifoodLastPollAt || null,
      },
      credentialsConfigured: isIfoodConfigured(),
      counters: { received, preparing, ready, delivered },
    });
  } catch (e) {
    return serverError(e);
  }
}

// PATCH: atualiza configuração da integração para a unidade
const patchSchema = z.object({
  ifoodEnabled: z.boolean().optional(),
  ifoodMerchantId: z.string().min(1).max(100).nullable().optional(),
  ifoodAutoConfirm: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return ok({ ok: false });

    const p = await parseBody(req, patchSchema);
    if (!p.ok) return p.res;

    const data: any = {};
    if (typeof p.data.ifoodEnabled === 'boolean') data.ifoodEnabled = p.data.ifoodEnabled;
    if (p.data.ifoodMerchantId !== undefined) data.ifoodMerchantId = p.data.ifoodMerchantId;
    if (typeof p.data.ifoodAutoConfirm === 'boolean') data.ifoodAutoConfirm = p.data.ifoodAutoConfirm;

    const unit = await (prisma.unit as any).update({ where: { id: unitId }, data });
    return ok({
      unit: {
        ifoodEnabled: !!unit.ifoodEnabled,
        ifoodMerchantId: unit.ifoodMerchantId || '',
        ifoodAutoConfirm: !!unit.ifoodAutoConfirm,
        ifoodStoreStatus: unit.ifoodStoreStatus,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
