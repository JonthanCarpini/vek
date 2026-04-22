import { NextRequest, NextResponse } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/guard';

/**
 * GET /api/v1/driver/auth/me
 * Retorna o motoboy logado.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireDriver(req);
    if (!g.ok) return g.res;

    const driver = await (prisma as any).driver.findUnique({
      where: { id: g.driver.sub },
    });
    if (!driver || !driver.active) return fail('Motoboy inativo', 401);

    return ok({
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicle,
        totalDeliveries: driver.totalDeliveries,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * POST /api/v1/driver/auth/me
 * Logout — limpa cookie md_driver.
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set('md_driver', '', { maxAge: 0, path: '/' });
  return res;
}

export const dynamic = 'force-dynamic';
