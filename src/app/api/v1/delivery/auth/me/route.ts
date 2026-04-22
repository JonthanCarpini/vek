import { NextRequest, NextResponse } from 'next/server';
import { ok, serverError } from '@/lib/api';
import { requireCustomer } from '@/lib/guard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/delivery/auth/me
 * Retorna os dados do cliente autenticado.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireCustomer(req);
    if (!g.ok) return g.res;

    const customer = await prisma.customer.findUnique({
      where: { id: g.customer.sub },
      select: {
        id: true, name: true, phone: true, email: true,
        photoUrl: true, totalOrders: true, totalSpent: true, createdAt: true,
      },
    });
    if (!customer) return ok({ customer: null });

    return ok({ customer });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * POST /api/v1/delivery/auth/logout
 * Limpa o cookie de sessão.
 */
export async function POST() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set('md_customer', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

export const dynamic = 'force-dynamic';
