import { ok, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/delivery/push/config
 * Retorna a VAPID public key da unit ativa para o cliente subscribir.
 * Se a loja não configurou push ainda, retorna enabled=false.
 */
export async function GET() {
  try {
    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { pushVapidPublicKey: true } as any,
    }) as any;

    const publicKey = unit?.pushVapidPublicKey || null;
    return ok({
      enabled: !!publicKey,
      publicKey,
    });
  } catch (e: any) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
