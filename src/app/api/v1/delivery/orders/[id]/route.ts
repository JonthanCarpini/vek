import { NextRequest } from 'next/server';
import { ok, serverError, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getCustomerFromRequest } from '@/lib/auth';

/**
 * GET /api/v1/delivery/orders/[id]
 * Detalhes completos de um pedido. Público (aceita tanto customer autenticado
 * quanto acesso por id do pedido — para página de tracking /t/[orderId]).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customer = getCustomerFromRequest(req);

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        customer: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true, vehicle: true } },
      },
    }) as any;

    if (!order) return fail('Pedido não encontrado', 404);
    // Se customer autenticado, valida que é o dono. Tracking público permite qualquer um que tenha o id.
    if (customer && order.customerId && order.customerId !== customer.sub) {
      return fail('Acesso negado', 403);
    }

    return ok({
      order: {
        id: order.id,
        sequenceNumber: order.sequenceNumber,
        status: order.status,
        orderType: order.orderType,
        channel: order.channel,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        total: Number(order.total),
        notes: order.notes,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentPaidAt: order.paymentPaidAt,
        changeFor: order.changeFor ? Number(order.changeFor) : null,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        distanceKm: order.distanceKm ? Number(order.distanceKm) : null,
        estimatedDeliveryAt: order.estimatedDeliveryAt,
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        readyAt: order.readyAt,
        dispatchedAt: order.dispatchedAt,
        deliveredAt: order.deliveredAt,
        driver: order.driver,
        items: order.items.map((i: any) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          notes: i.notes,
          status: i.status,
        })),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
