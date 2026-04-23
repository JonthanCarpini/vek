import { NextRequest } from 'next/server';
import { ok, serverError, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * POST /api/v1/delivery/push/unsubscribe
 * Remove a subscription pelo endpoint. Não exige auth
 * para permitir que o browser limpe ao revogar permissão.
 */
const schema = z.object({
  endpoint: z.string().url().max(500),
});

export async function POST(req: NextRequest) {
  try {
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;
    await (prisma as any).pushSubscription.deleteMany({
      where: { endpoint: p.data.endpoint },
    });
    return ok({});
  } catch (e: any) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
