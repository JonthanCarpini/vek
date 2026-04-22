// OTP (One-Time Password) via WhatsApp para autenticação do cliente no delivery.
// - Código de 6 dígitos, válido por 5 minutos
// - Máximo 3 tentativas por código antes de invalidar
// - Rate limit: máximo 3 códigos ativos por telefone em 10 minutos

import { prisma } from '@/lib/prisma';
import { whatsappService } from '@/lib/whatsapp';

const OTP_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const MAX_ACTIVE_CODES_PER_PHONE = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;

export type OtpPurpose = 'customer_login' | 'driver_login';

export class OtpError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'OtpError';
  }
}

/**
 * Normaliza telefone para formato E.164 brasileiro (55 + DDD + número).
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) throw new OtpError('Telefone inválido', 'INVALID_PHONE');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function generateCode(): string {
  // 6 dígitos - usamos Math.random (suficiente para OTP + DB indexado contra brute-force)
  return Math.floor(100000 + Math.random() * 900000).toString().padStart(OTP_LENGTH, '0');
}

/**
 * Gera e envia um código OTP via WhatsApp.
 * Retorna { success, expiresAt } ou lança OtpError.
 */
export async function requestOtp(params: {
  unitId: string;
  phone: string;
  purpose?: OtpPurpose;
}): Promise<{ expiresAt: Date; debugCode?: string }> {
  const { unitId, purpose = 'customer_login' } = params;
  const phone = normalizePhone(params.phone);

  // Rate limit: contar códigos ativos recentes
  const recentWindow = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
  const activeCount = await (prisma as any).otpCode.count({
    where: {
      unitId,
      phone,
      purpose,
      consumed: false,
      createdAt: { gte: recentWindow },
    },
  });
  if (activeCount >= MAX_ACTIVE_CODES_PER_PHONE) {
    throw new OtpError(
      'Muitos códigos enviados. Aguarde alguns minutos antes de tentar novamente.',
      'RATE_LIMITED',
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60_000);

  await (prisma as any).otpCode.create({
    data: { unitId, phone, code, purpose, expiresAt },
  });

  // Envia via WhatsApp. Em desenvolvimento, se WhatsApp não estiver conectado,
  // retornamos o código no response (flag debugCode).
  const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
  const unitName = unit?.name || 'Mesa Digital';

  const message = [
    `🔐 *${unitName}*`,
    ``,
    `Seu código de acesso é:`,
    ``,
    `*${code}*`,
    ``,
    `Válido por ${OTP_EXPIRATION_MINUTES} minutos.`,
    `Não compartilhe este código com ninguém.`,
  ].join('\n');

  try {
    await whatsappService.sendMessage(unitId, phone, message);
  } catch (err: any) {
    // Se o WhatsApp não estiver conectado em produção, é erro operacional
    if (process.env.NODE_ENV === 'production') {
      console.error('[OTP] Falha ao enviar via WhatsApp:', err?.message || err);
      throw new OtpError(
        'Não foi possível enviar o código via WhatsApp. Tente novamente em instantes.',
        'WHATSAPP_UNAVAILABLE',
      );
    }
    // Em dev, retorna o código para facilitar testes
    return { expiresAt, debugCode: code };
  }

  return { expiresAt };
}

/**
 * Valida um código OTP. Em caso de sucesso, marca como consumed.
 * Retorna true se válido, ou lança OtpError.
 */
export async function verifyOtp(params: {
  unitId: string;
  phone: string;
  code: string;
  purpose?: OtpPurpose;
}): Promise<boolean> {
  const { unitId, purpose = 'customer_login' } = params;
  const phone = normalizePhone(params.phone);
  const code = params.code.trim();

  if (!/^\d{6}$/.test(code)) {
    throw new OtpError('Código deve ter 6 dígitos', 'INVALID_FORMAT');
  }

  const record = await (prisma as any).otpCode.findFirst({
    where: {
      unitId,
      phone,
      purpose,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new OtpError('Código expirado ou não encontrado', 'NOT_FOUND');
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    // Invalida
    await (prisma as any).otpCode.update({
      where: { id: record.id },
      data: { consumed: true },
    });
    throw new OtpError('Limite de tentativas excedido. Solicite novo código.', 'MAX_ATTEMPTS');
  }

  if (record.code !== code) {
    await (prisma as any).otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    throw new OtpError(
      `Código inválido. ${remaining} tentativa(s) restante(s).`,
      'INVALID_CODE',
    );
  }

  // Sucesso - marca como consumido
  await (prisma as any).otpCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });
  return true;
}

/**
 * Limpa códigos expirados (executar periodicamente). Não é obrigatório mas mantém a tabela enxuta.
 */
export async function cleanupExpiredOtps() {
  const cutoff = new Date(Date.now() - 60 * 60_000); // 1h atrás
  await (prisma as any).otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() }, consumed: false },
        { createdAt: { lt: cutoff } },
      ],
    },
  });
}
