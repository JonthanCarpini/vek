import { NextRequest } from 'next/server';
import { ok, fail, serverError, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireCustomer } from '@/lib/guard';
import { z } from 'zod';

const schema = z.object({
  token: z.string().min(10).max(255),
});

/**
 * POST /api/v1/delivery/fcm
 * Registra/atualiza o FCM token do device do cliente logado.
 * Chamado pelo app Capacitor ao iniciar a sessão.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireCustomer(req);
    if (!auth.ok) return auth.res;

    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { id: true } as any,
    }) as any;
    if (!unit) return fail('Loja não encontrada', 404);

    await (prisma as any).fcmToken.upsert({
      where: { token: p.data.token },
      create: {
        token: p.data.token,
        customerId: auth.customer.sub,
        unitId: unit.id,
      },
      update: {
        customerId: auth.customer.sub,
        unitId: unit.id,
        updatedAt: new Date(),
      },
    });

    return ok({ registered: true });
  } catch (e: any) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
