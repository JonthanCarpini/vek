import { NextRequest, NextResponse } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { signDriver } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.startsWith('55') ? d : `55${d}`;
}

const schema = z.object({
  phone: z.string().trim().min(10).max(20),
  pin: z.string().trim().regex(/^\d{4,6}$/, 'PIN deve ter 4-6 dígitos'),
});

/**
 * POST /api/v1/driver/auth/login
 * Login do motoboy via telefone + PIN.
 * Returna JWT em cookie httpOnly `md_driver` (30d).
 */
export async function POST(req: NextRequest) {
  try {
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const phone = normalizePhone(p.data.phone);
    const driver = await (prisma as any).driver.findFirst({
      where: { phone, active: true },
    });
    if (!driver || !driver.pinHash) return fail('Telefone ou PIN inválidos', 401);

    const valid = await bcrypt.compare(p.data.pin, driver.pinHash);
    if (!valid) return fail('Telefone ou PIN inválidos', 401);

    await (prisma as any).driver.update({
      where: { id: driver.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signDriver({
      sub: driver.id,
      uid: driver.unitId,
      name: driver.name,
      phone: driver.phone,
    });

    const res = NextResponse.json({
      data: {
        token,
        driver: { id: driver.id, name: driver.name, phone: driver.phone, vehicle: driver.vehicle },
      },
    });
    res.cookies.set('md_driver', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
