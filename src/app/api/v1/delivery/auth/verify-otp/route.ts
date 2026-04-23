import { NextRequest, NextResponse } from 'next/server';
import { serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { verifyOtp, normalizePhone, OtpError } from '@/lib/delivery/otp';
import { signCustomer } from '@/lib/auth';
import { z } from 'zod';

/**
 * POST /api/v1/delivery/auth/verify-otp
 * Body: { phone, code, name? }
 * Verifica código. Se válido, cria/atualiza Customer e retorna JWT + dados.
 * O JWT é também setado como cookie httpOnly (md_customer).
 */
const schema = z.object({
  phone: z.string().trim().min(10).max(20),
  code: z.string().trim().length(6),
  name: z.string().trim().min(2).max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: { id: true, deliveryEnabled: true, takeoutEnabled: true } as any,
    }) as any;
    if (!unit) return fail('Loja não encontrada', 404);
    if (!unit.deliveryEnabled && !unit.takeoutEnabled) return fail('Delivery indisponível', 400);

    await verifyOtp({ unitId: unit.id, phone: p.data.phone, code: p.data.code });

    const normalizedPhone = normalizePhone(p.data.phone);

    let customer = await prisma.customer.findFirst({
      where: { unitId: unit.id, phone: normalizedPhone },
    }) as any;

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          unitId: unit.id,
          name: p.data.name?.trim() || 'Cliente',
          phone: normalizedPhone,
          phoneVerified: true,
          lastLoginAt: new Date(),
        } as any,
      });
    } else {
      const updateData: any = { lastLoginAt: new Date(), phoneVerified: true };
      if (p.data.name && p.data.name.trim() && p.data.name.trim() !== customer.name) {
        updateData.name = p.data.name.trim();
      }
      customer = await (prisma.customer as any).update({
        where: { id: customer.id },
        data: updateData,
      });
    }

    const token = signCustomer({
      sub: customer.id,
      uid: unit.id,
      phone: normalizedPhone,
      name: customer.name,
    });

    const res = NextResponse.json({
      data: {
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
      },
    });

    res.cookies.set('md_customer', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 24 * 60 * 60, // 60 dias
    });

    return res;
  } catch (e: any) {
    if (e instanceof OtpError) return fail(e.message, 400);
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
