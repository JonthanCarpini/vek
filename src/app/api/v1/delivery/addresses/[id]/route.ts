import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireCustomer } from '@/lib/guard';

/**
 * DELETE /api/v1/delivery/addresses/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireCustomer(req);
    if (!g.ok) return g.res;
    const { id } = await params;

    const address = await (prisma as any).deliveryAddress.findUnique({ where: { id } });
    if (!address || address.customerId !== g.customer.sub) {
      return fail('Endereço não encontrado', 404);
    }

    await (prisma as any).deliveryAddress.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
