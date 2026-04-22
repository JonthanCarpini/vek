import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/guard';
import { emitToKitchen, emitToDashboard, emitToWaiters, SocketEvents } from '@/lib/socket';
import { whatsappService } from '@/lib/whatsapp';
import { z } from 'zod';

/**
 * POST /api/v1/admin/delivery/orders/[id]/status
 * Body: { status }
 * Valores permitidos: accepted, preparing, ready, dispatched, delivered, cancelled
 */
const schema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ['super_admin', 'admin', 'manager', 'cashier']);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Staff sem unidade associada', 400);

    const { id } = await params;
    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const order = await prisma.order.findUnique({ where: { id } }) as any;
    if (!order || order.unitId !== g.staff.unitId) return fail('Pedido não encontrado', 404);
    if (order.channel !== 'delivery') return fail('Pedido não é de delivery', 400);

    const now = new Date();
    const data: any = { status: p.data.status };
    if (p.data.status === 'accepted') data.acceptedAt = now;
    if (p.data.status === 'ready') data.readyAt = now;
    if (p.data.status === 'dispatched') data.dispatchedAt = now;
    if (p.data.status === 'delivered') data.deliveredAt = now;
    if (p.data.status === 'cancelled' && p.data.reason) {
      data.notes = (order.notes ? order.notes + '\n' : '') + `[Cancelado: ${p.data.reason}]`;
    }

    const updated = await prisma.order.update({
      where: { id },
      data,
      include: { items: true, driver: true },
    }) as any;

    // Se entregue, incrementa estatística do motoboy
    if (p.data.status === 'delivered' && updated.driverId) {
      await (prisma as any).driver.update({
        where: { id: updated.driverId },
        data: { totalDeliveries: { increment: 1 } },
      });
    }

    // Se cancelado, fecha a sessão virtual
    if (p.data.status === 'cancelled') {
      await prisma.tableSession.update({
        where: { id: order.sessionId },
        data: { status: 'cancelled' } as any,
      });
    }

    // Notifica via socket
    const payload = {
      id: updated.id,
      sequenceNumber: updated.sequenceNumber,
      status: updated.status,
      orderType: updated.orderType,
      channel: 'delivery',
    };
    emitToKitchen(g.staff.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
    emitToWaiters(g.staff.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);
    emitToDashboard(g.staff.unitId, SocketEvents.ORDER_STATUS_CHANGED, payload);

    // Notifica cliente via WhatsApp (fire-and-forget)
    notifyCustomerStatus(updated).catch((e) => console.error('[Delivery] WhatsApp notify:', e));

    return ok({ ok: true, order: payload });
  } catch (e) {
    return serverError(e);
  }
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

export const dynamic = 'force-dynamic';
