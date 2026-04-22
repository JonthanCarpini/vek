import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/guard';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.startsWith('55') ? d : `55${d}`;
}

/**
 * GET /api/v1/admin/drivers
 * Lista motoboys. Query: ?active=true para filtrar ativos.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager', 'cashier']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade', 400);

    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
    const where: any = { unitId: g.staff.unitId };
    if (activeOnly) where.active = true;

    const drivers = await (prisma as any).driver.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return ok({
      drivers: drivers.map((d: any) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle,
        licensePlate: d.licensePlate,
        active: d.active,
        totalDeliveries: d.totalDeliveries,
        lastLoginAt: d.lastLoginAt,
        hasPin: !!d.pinHash,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  vehicle: z.enum(['moto', 'bike', 'carro', 'pe']).default('moto'),
  licensePlate: z.string().trim().max(10).optional(),
  pin: z.string().trim().regex(/^\d{4,6}$/, 'PIN deve ter 4-6 dígitos').optional(),
});

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade', 400);

    const p = await parseBody(req, createSchema);
    if (!p.ok) return p.res;

    const phone = normalizePhone(p.data.phone);
    const existing = await (prisma as any).driver.findFirst({
      where: { unitId: g.staff.unitId, phone },
    });
    if (existing) return fail('Já existe motoboy com esse telefone', 409);

    const pinHash = p.data.pin ? await bcrypt.hash(p.data.pin, 10) : null;

    const driver = await (prisma as any).driver.create({
      data: {
        unitId: g.staff.unitId,
        name: p.data.name,
        phone,
        vehicle: p.data.vehicle,
        licensePlate: p.data.licensePlate,
        pinHash,
        active: true,
      },
    });

    return ok({ id: driver.id });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
