import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requestOtp, OtpError } from '@/lib/delivery/otp';
import { z } from 'zod';

/**
 * POST /api/v1/delivery/auth/request-otp
 * Body: { phone: string }
 * Envia um código OTP via WhatsApp para o telefone informado.
 */
const schema = z.object({
  phone: z.string().trim().min(10).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { id: true, deliveryEnabled: true, takeoutEnabled: true, whatsappEnabled: true, whatsappStatus: true } as any,
    }) as any;

    if (!unit) return fail('Loja não encontrada', 404);
    if (!unit.deliveryEnabled && !unit.takeoutEnabled) return fail('Esta loja não faz delivery nem retirada', 400);
    if (!unit.whatsappEnabled || unit.whatsappStatus !== 'connected') {
      return fail('Serviço de WhatsApp indisponível. Tente novamente em instantes.', 503);
    }

    const result = await requestOtp({ unitId: unit.id, phone: p.data.phone });
    return ok({
      ok: true,
      expiresAt: result.expiresAt,
      ...(result.debugCode ? { debugCode: result.debugCode } : {}),
    });
  } catch (e: any) {
    if (e instanceof OtpError) {
      return fail(e.message, e.code === 'RATE_LIMITED' ? 429 : 400);
    }
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
