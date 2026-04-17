import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { stockAdjustSchema } from '@/lib/validators';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;
    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing || existing.unitId !== g.staff.unitId) return notFound();
    const p = await parseBody(req, stockAdjustSchema);
    if (!p.ok) return p.res;
    const updated = await prisma.ingredient.update({
      where: { id },
      data: { stock: { increment: p.data.delta } },
    });
    await prisma.auditLog.create({
      data: {
        actorId: g.staff.sub,
        action: 'stock_adjust',
        entity: 'Ingredient',
        entityId: id,
        diff: JSON.stringify({ delta: p.data.delta, reason: p.data.reason, newStock: updated.stock }),
      },
    });
    return ok({ ingredient: updated });
  } catch (e) { return serverError(e); }
}
