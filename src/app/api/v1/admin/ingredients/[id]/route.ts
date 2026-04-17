import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { ingredientSchema } from '@/lib/validators';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;
    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing || existing.unitId !== g.staff.unitId) return notFound();
    const p = await parseBody(req, ingredientSchema);
    if (!p.ok) return p.res;
    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: {
        name: p.data.name,
        unitOfMeasure: p.data.unitOfMeasure,
        stock: p.data.stock ?? existing.stock,
        minStock: p.data.minStock ?? existing.minStock,
        cost: p.data.cost ?? existing.cost,
        active: p.data.active ?? existing.active,
      },
    });
    return ok({ ingredient });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;
    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing || existing.unitId !== g.staff.unitId) return notFound();
    await prisma.ingredient.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e: any) {
    if (String(e?.code) === 'P2003') return fail('Ingrediente em uso em produtos. Desative em vez de excluir.', 409);
    return serverError(e);
  }
}
