import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/guard';
import { updateDeliveryOrderStatus } from '@/lib/delivery/status';
import { z } from 'zod';

/**
 * POST /api/v1/driver/orders/[id]/status
 * Motoboy só pode transicionar para 'dispatched' (saiu) ou 'delivered' (entregue).
 * E somente em pedidos atribuídos a ele.
 */
const schema = z.object({
  status: z.enum(['dispatched', 'delivered']),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireDriver(req);
    if (!g.ok) return g.res;

    const { id } = await params;
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const order = await prisma.order.findUnique({ where: { id } }) as any;
    if (!order) return fail('Pedido não encontrado', 404);
    if (order.driverId !== g.driver.sub) return fail('Este pedido não é seu', 403);

    // Regras de transição:
    //  - dispatched: só permitido se estava 'ready'
    //  - delivered:  só permitido se estava 'dispatched'
    if (p.data.status === 'dispatched' && order.status !== 'ready') {
      return fail('Pedido ainda não está pronto', 400);
    }
    if (p.data.status === 'delivered' && order.status !== 'dispatched') {
      return fail('Marque primeiro como "Saí para entrega"', 400);
    }

    const result = await updateDeliveryOrderStatus({
      orderId: id,
      status: p.data.status,
    });
    if (!result.ok) return fail(result.error, result.status);

    return ok({
      ok: true,
      order: {
        id: result.order.id,
        sequenceNumber: result.order.sequenceNumber,
        status: result.order.status,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
