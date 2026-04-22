import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * GET - Retorna o status atual das credenciais (sem expor o secret).
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin']);
    if (!g.ok) return g.res;

    const unitId = g.staff.unitId;
    if (!unitId) return fail('Sem unidade associada', 400);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { tenantId: true },
    });
    if (!unit) return fail('Unidade não encontrada', 404);

    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: unit.tenantId },
      select: { ifoodClientId: true, ifoodClientSecret: true },
    });

    return ok({
      clientId: tenant?.ifoodClientId || '',
      hasClientSecret: !!tenant?.ifoodClientSecret,
      // Mostra apenas os últimos 4 caracteres do secret por segurança
      clientSecretHint: tenant?.ifoodClientSecret
        ? `••••${String(tenant.ifoodClientSecret).slice(-4)}`
        : '',
    });
  } catch (e) {
    return serverError(e);
  }
}

const patchSchema = z.object({
  clientId: z.string().trim().min(1).max(200),
  clientSecret: z.string().trim().min(1).max(500).optional(), // opcional: se omitido, mantém o atual
});

/**
 * PATCH - Atualiza as credenciais iFood do Tenant da unidade.
 * Somente super_admin e admin podem alterar.
 */
export async function PATCH(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin']);
    if (!g.ok) return g.res;

    const unitId = g.staff.unitId;
    if (!unitId) return fail('Sem unidade associada', 400);

    const p = await parseBody(req, patchSchema);
    if (!p.ok) return p.res;

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { tenantId: true },
    });
    if (!unit) return fail('Unidade não encontrada', 404);

    const data: any = { ifoodClientId: p.data.clientId };
    if (p.data.clientSecret) data.ifoodClientSecret = p.data.clientSecret;

    await (prisma as any).tenant.update({
      where: { id: unit.tenantId },
      data,
    });

    // Invalida cache de token (força refresh no próximo request)
    await (prisma as any).ifoodToken
      .deleteMany({ where: { unitId: null } })
      .catch(() => {});

    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * DELETE - Remove as credenciais.
 */
export async function DELETE(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin']);
    if (!g.ok) return g.res;

    const unitId = g.staff.unitId;
    if (!unitId) return fail('Sem unidade associada', 400);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { tenantId: true },
    });
    if (!unit) return fail('Unidade não encontrada', 404);

    await (prisma as any).tenant.update({
      where: { id: unit.tenantId },
      data: { ifoodClientId: null, ifoodClientSecret: null },
    });
    await (prisma as any).ifoodToken
      .deleteMany({ where: { unitId: null } })
      .catch(() => {});

    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
