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
        driver: {
          select: {
            id: true, name: true, phone: true, vehicle: true,
            currentLat: true, currentLng: true, lastLocationAt: true,
          },
        },
        unit: { select: { addressLat: true, addressLng: true } },
      } as any,
    }) as any;

    if (!order) return fail('Pedido não encontrado', 404);
    if (customer && order.customerId && order.customerId !== customer.sub) {
      return fail('Acesso negado', 403);
    }

    const shareDriverLocation = order.status === 'dispatched' && order.driver?.currentLat != null;
    const driverInfo = order.driver ? {
      id: order.driver.id,
      name: order.driver.name,
      phone: order.driver.phone,
      vehicle: order.driver.vehicle,
      currentLat: shareDriverLocation ? Number(order.driver.currentLat) : null,
      currentLng: shareDriverLocation ? Number(order.driver.currentLng) : null,
      lastLocationAt: shareDriverLocation ? order.driver.lastLocationAt : null,
    } : null;

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
        deliveryLat: order.deliveryLat ? Number(order.deliveryLat) : null,
        deliveryLng: order.deliveryLng ? Number(order.deliveryLng) : null,
        distanceKm: order.distanceKm ? Number(order.distanceKm) : null,
        estimatedDeliveryAt: order.estimatedDeliveryAt,
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        readyAt: order.readyAt,
        dispatchedAt: order.dispatchedAt,
        deliveredAt: order.deliveredAt,
        driver: driverInfo,
        origin: order.unit?.addressLat != null && order.unit?.addressLng != null
          ? { lat: Number(order.unit.addressLat), lng: Number(order.unit.addressLng) }
          : null,
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
