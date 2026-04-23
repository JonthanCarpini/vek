import { NextRequest } from 'next/server';
import { ok, fail, serverError, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireCustomer } from '@/lib/guard';
import { z } from 'zod';

/**
 * POST /api/v1/delivery/push/subscribe
 * Registra/atualiza uma subscription de Web Push para o customer autenticado.
 * O endpoint é único (identifica device+browser), então usamos upsert.
 */
const schema = z.object({
  endpoint: z.string().url().max(500),
  p256dh: z.string().min(10).max(255),
  auth: z.string().min(10).max(255),
  userAgent: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCustomer(req);
    if (!auth.ok) return auth.res;

    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { id: true } as any,
    }) as any;
    if (!unit) return fail('Loja não encontrada', 404);

    const customerId = auth.customer.sub;
    const sub = await (prisma as any).pushSubscription.upsert({
      where: { endpoint: p.data.endpoint },
      create: {
        unitId: unit.id,
        customerId,
        endpoint: p.data.endpoint,
        p256dh: p.data.p256dh,
        auth: p.data.auth,
        userAgent: p.data.userAgent || null,
      },
      update: {
        customerId, // caso o device tenha trocado de usuário
        p256dh: p.data.p256dh,
        auth: p.data.auth,
        userAgent: p.data.userAgent || null,
        lastSeenAt: new Date(),
      },
    });

    return ok({ id: sub.id });
  } catch (e: any) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
