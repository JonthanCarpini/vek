import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/api';

export async function GET(_req: NextRequest) {
  try {
    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: {
        id: true, name: true, address: true, phone: true,
        whatsapp: true, logoUrl: true, primaryColor: true,
        serviceFee: true, paymentMethods: true, onlinePaymentEnabled: true,
      },
    });
    return ok({ unit });
  } catch (e) { return serverError(e); }
}
