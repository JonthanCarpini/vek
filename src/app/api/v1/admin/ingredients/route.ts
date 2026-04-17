import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { ingredientSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const ingredients = await prisma.ingredient.findMany({
      where: { unitId: g.staff.unitId },
      orderBy: { name: 'asc' },
    });
    return ok({ ingredients });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const p = await parseBody(req, ingredientSchema);
    if (!p.ok) return p.res;
    const ingredient = await prisma.ingredient.create({
      data: {
        unitId: g.staff.unitId,
        name: p.data.name,
        unitOfMeasure: p.data.unitOfMeasure,
        stock: p.data.stock ?? 0,
        minStock: p.data.minStock ?? 0,
        cost: p.data.cost ?? 0,
        active: p.data.active ?? true,
      },
    });
    return ok({ ingredient });
  } catch (e: any) {
    if (String(e?.code) === 'P2002') return fail('Já existe um ingrediente com este nome', 409);
    return serverError(e);
  }
}
