import { NextRequest } from 'next/server';
import { ok, fail, serverError, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff, ROLES } from '@/lib/guard';
import { generateVapidKeys } from '@/lib/delivery/push';
import { z } from 'zod';

/**
 * GET  — retorna config VAPID atual (sem a private key) da Unit ativa
 * PATCH — salva public/private/subject fornecidos manualmente
 * POST  — gera novo par de chaves e salva (subject deve ser informado)
 *
 * Apenas super_admin/admin/manager podem gerenciar.
 */

async function getActiveUnitId() {
  const unit = await prisma.unit.findFirst({
    where: { active: true },
    select: { id: true },
  });
  return unit?.id || null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireStaff(req, ROLES.MANAGER_UP);
    if (!auth.ok) return auth.res;

    const unitId = await getActiveUnitId();
    if (!unitId) return fail('Loja não encontrada', 404);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        pushVapidPublicKey: true,
        pushVapidSubject: true,
      } as any,
    }) as any;

    // Conta subscriptions ativas para feedback ao admin
    const subscriptions = await (prisma as any).pushSubscription.count({
      where: { unitId },
    });

    return ok({
      publicKey: unit?.pushVapidPublicKey || null,
      subject: unit?.pushVapidSubject || null,
      configured: !!(unit?.pushVapidPublicKey && unit?.pushVapidSubject),
      subscriptions,
    });
  } catch (e: any) {
    return serverError(e);
  }
}

const patchSchema = z.object({
  publicKey: z.string().min(20).max(500),
  privateKey: z.string().min(20).max(500),
  subject: z.string().regex(
    /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$|^https:\/\/\S+$/,
    'Subject inválido: use mailto:email@dominio.com ou https://seusite.com',
  ),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireStaff(req, ROLES.MANAGER_UP);
    if (!auth.ok) return auth.res;

    const p = await parseBody(req, patchSchema);
    if (!p.ok) return p.res;

    const unitId = await getActiveUnitId();
    if (!unitId) return fail('Loja não encontrada', 404);

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        pushVapidPublicKey: p.data.publicKey,
        pushVapidPrivateKey: p.data.privateKey,
        pushVapidSubject: p.data.subject,
      } as any,
    });
    return ok({ saved: true });
  } catch (e: any) {
    return serverError(e);
  }
}

const generateSchema = z.object({
  subject: z.string().regex(
    /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$|^https:\/\/\S+$/,
    'Subject inválido: use mailto:email@dominio.com ou https://seusite.com',
  ),
});

export async function POST(req: NextRequest) {
  try {
    const auth = requireStaff(req, ROLES.MANAGER_UP);
    if (!auth.ok) return auth.res;

    const p = await parseBody(req, generateSchema);
    if (!p.ok) return p.res;

    const unitId = await getActiveUnitId();
    if (!unitId) return fail('Loja não encontrada', 404);

    const keys = generateVapidKeys();
    await prisma.unit.update({
      where: { id: unitId },
      data: {
        pushVapidPublicKey: keys.publicKey,
        pushVapidPrivateKey: keys.privateKey,
        pushVapidSubject: p.data.subject,
      } as any,
    });

    // Retorna apenas public para o UI mostrar; private é "write-only"
    return ok({
      publicKey: keys.publicKey,
      subject: p.data.subject,
      generated: true,
    });
  } catch (e: any) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
