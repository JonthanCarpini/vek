import { prisma } from '@/lib/prisma';
import { emitToKitchen, emitToDashboard, emitToWaiters, SocketEvents } from '@/lib/socket';
import { whatsappService } from '@/lib/whatsapp';
import { sendPushToCustomer, statusPushTemplates } from './push';

export type DeliveryStatus = 'accepted' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

export interface StatusChangeInput {
  orderId: string;
  status: DeliveryStatus;
  reason?: string;
  expectedUnitId?: string;  // para validação extra (staff)
}

/**
 * Atualiza status de um pedido de delivery, emite sockets,
 * incrementa stats do motoboy e notifica cliente via WhatsApp.
 */
export async function updateDeliveryOrderStatus(input: StatusChangeInput): Promise<
  | { ok: true; order: any }
  | { ok: false; error: string; status: number }
> {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } }) as any;
  if (!order) return { ok: false, error: 'Pedido não encontrado', status: 404 };
  if (input.expectedUnitId && order.unitId !== input.expectedUnitId) {
    return { ok: false, error: 'Pedido não encontrado', status: 404 };
  }
  if (order.channel !== 'delivery') {
    return { ok: false, error: 'Pedido não é de delivery', status: 400 };
  }

  const now = new Date();
  const data: any = { status: input.status };
  if (input.status === 'accepted') data.acceptedAt = now;
  if (input.status === 'ready') data.readyAt = now;
  if (input.status === 'dispatched') data.dispatchedAt = now;
  if (input.status === 'delivered') data.deliveredAt = now;
  if (input.status === 'cancelled' && input.reason) {
    data.notes = (order.notes ? order.notes + '\n' : '') + `[Cancelado: ${input.reason}]`;
  }

  const updated = await prisma.order.update({
    where: { id: input.orderId },
    data,
    include: { items: true, driver: true } as any,
  }) as any;

  if (input.status === 'delivered' && updated.driverId) {
    await (prisma as any).driver.update({
      where: { id: updated.driverId },
      data: { totalDeliveries: { increment: 1 } },
    });
  }

  if (input.status === 'cancelled') {
    await prisma.tableSession.update({
      where: { id: order.sessionId },
      data: { status: 'cancelled' } as any,
    });
  }

  const payload = {
    id: updated.id,
    sequenceNumber: updated.sequenceNumber,
    status: updated.status,
    orderType: updated.orderType,
    channel: 'delivery',
  };
  emitToKitchen(order.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
  emitToWaiters(order.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
  emitToDashboard(order.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);

  notifyCustomerStatus(updated).catch((e) => console.error('[Delivery] WhatsApp notify:', e));
  notifyCustomerPush(updated).catch((e) => console.error('[Delivery] Push notify:', e));

  return { ok: true, order: updated };
}

async function notifyCustomerPush(order: any) {
  if (!order.customerId) return;
  const template = statusPushTemplates[order.status];
  if (!template) return;
  const payload = template(order.sequenceNumber);
  payload.url = `/delivery/pedidos/${order.id}`;
  payload.data = { orderId: order.id, status: order.status };
  await sendPushToCustomer({
    unitId: order.unitId,
    customerId: order.customerId,
    payload,
  });
}

async function notifyCustomerStatus(order: any) {
  if (!order.customerPhone) return;
  const unit = await prisma.unit.findUnique({ where: { id: order.unitId } }) as any;
  if (!unit?.whatsappEnabled) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const tracking = appUrl ? `\n\n🔗 Acompanhe: ${appUrl}/t/${order.id}` : '';

  const messages: Record<string, string> = {
    accepted: `✅ *Pedido #${order.sequenceNumber} confirmado*\n\nSua comida já vai entrar em preparo! 👨‍🍳${tracking}`,
    preparing: `👨‍🍳 *Pedido #${order.sequenceNumber} em preparo*\n\nEstamos preparando seu pedido com carinho!${tracking}`,
    ready: order.orderType === 'takeout'
      ? `🛍️ *Pedido #${order.sequenceNumber} pronto!*\n\nPode vir buscar no balcão!${tracking}`
      : `📦 *Pedido #${order.sequenceNumber} pronto*\n\nEm instantes sai para entrega!${tracking}`,
    dispatched: `🛵 *Pedido #${order.sequenceNumber} saiu para entrega*\n\n${order.driver?.name ? `Entregador: *${order.driver.name}*` : 'Já está a caminho!'} 🏍️💨${tracking}`,
    delivered: `✨ *Pedido #${order.sequenceNumber} entregue*\n\nObrigado pela preferência! Esperamos você de volta. 💚`,
    cancelled: `❌ *Pedido #${order.sequenceNumber} cancelado*\n\nEntre em contato conosco para mais informações.`,
  };

  const msg = messages[order.status];
  if (msg) {
    await whatsappService.sendMessage(order.unitId, order.customerPhone, msg);
  }
}
