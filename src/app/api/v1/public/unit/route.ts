import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/api';
import { getStoreState } from '@/lib/store';

export async function GET(_req: NextRequest) {
  try {
    const unit = await prisma.unit.findFirst({
      where: { active: true },
      select: {
        id: true, name: true, address: true, phone: true,
        whatsapp: true, instagram: true, logoUrl: true, primaryColor: true,
        serviceFee: true, paymentMethods: true, onlinePaymentEnabled: true,
        slug: true, deliveryEnabled: true, takeoutEnabled: true,
        businessHours: {
          where: { active: true },
          select: { weekday: true, openTime: true, closeTime: true }
        }
      },
    });

    if (!unit) return ok({ unit: null });

    const state = await getStoreState(unit.id);

    return ok({ 
      unit: {
        ...unit,
        isOpen: state.open,
        openReason: state.reason,
        currentSchedule: state.schedule
      } 
    });
  } catch (e) { return serverError(e); }
}
