import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import {
  publishProductToIfood,
  unpublishProductFromIfood,
  setIfoodItemAvailability,
} from '@/lib/ifood/catalog';
import { z } from 'zod';

const schema = z.object({
  productId: z.string().min(1),
  action: z.enum(['publish', 'unpublish', 'availability']),
  available: z.boolean().optional(), // usado quando action=availability
});

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;

    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    if (p.data.action === 'publish') {
      const result = await publishProductToIfood(p.data.productId);
      return ok({ result });
    }
    if (p.data.action === 'unpublish') {
      await unpublishProductFromIfood(p.data.productId);
      return ok({ result: { unpublished: true } });
    }
    // availability
    if (p.data.available === undefined) return fail('available é obrigatório', 400);
    await setIfoodItemAvailability(p.data.productId, p.data.available);
    return ok({ result: { available: p.data.available } });
  } catch (e: any) {
    if (
      e?.message?.includes('não encontrado') ||
      e?.message?.includes('merchantId') ||
      e?.message?.includes('desativada') ||
      e?.message?.includes('catálogo')
    ) {
      return fail(e.message, 400);
    }
    return serverError(e);
  }
}
