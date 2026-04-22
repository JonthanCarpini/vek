import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/guard';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  vehicle: z.enum(['moto', 'bike', 'carro', 'pe']).optional(),
  licensePlate: z.string().trim().max(10).nullable().optional(),
  active: z.boolean().optional(),
  pin: z.string().trim().regex(/^\d{4,6}$/).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade', 400);

    const { id } = await params;
    const p = await parseBody(req, updateSchema);
    if (!p.ok) return p.res;

    const driver = await (prisma as any).driver.findUnique({ where: { id } });
    if (!driver || driver.unitId !== g.staff.unitId) return fail('Motoboy não encontrado', 404);

    const data: any = { ...p.data };
    if (p.data.phone) {
      const d = p.data.phone.replace(/\D/g, '');
      data.phone = d.startsWith('55') ? d : `55${d}`;
    }
    if (p.data.pin === null) {
      data.pinHash = null;
      delete data.pin;
    } else if (p.data.pin) {
      data.pinHash = await bcrypt.hash(p.data.pin, 10);
      delete data.pin;
    }

    await (prisma as any).driver.update({ where: { id }, data });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade', 400);

    const { id } = await params;
    const driver = await (prisma as any).driver.findUnique({ where: { id } });
    if (!driver || driver.unitId !== g.staff.unitId) return fail('Motoboy não encontrado', 404);

    // Soft delete (inativa, preserva histórico de pedidos)
    await (prisma as any).driver.update({
      where: { id },
      data: { active: false },
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
