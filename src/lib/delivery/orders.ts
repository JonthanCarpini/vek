// Criação de pedidos de delivery/takeout.
// - Reaproveita mesa virtual e sessão virtual por pedido
// - Valida estoque e deduz ingredientes (como no dine_in)
// - Calcula taxa de entrega dinamicamente
// - Suporta pagamento na entrega ou online (status pending)

import { prisma } from '@/lib/prisma';
import { emitToKitchen, emitToWaiters, emitToDashboard, SocketEvents } from '@/lib/socket';
import { whatsappService } from '@/lib/whatsapp';
import { formatBRL } from '@/lib/format';
import { serializeOrder } from '@/lib/orders';
import { getOrCreateDeliveryVirtualTable, createDeliverySession } from './virtual-table';
import { calculateDeliveryFee } from './pricing';
import { syncProductAvailability } from '@/lib/stock-sync';

export type DeliveryOrderItemInput = {
  productId: string;
  quantity: number;
  notes?: string | null;
};

export type DeliveryOrderInput = {
  unitId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderType: 'delivery' | 'takeout';
  items: DeliveryOrderItemInput[];
  notes?: string | null;
  // Endereço (obrigatório se delivery)
  addressId?: string;
  addressText?: string; // quando não é salvo
  customerLat?: number;
  customerLng?: number;
  // Pagamento
  paymentMethod: 'cash' | 'credit' | 'debit' | 'pix' | 'online';
  changeFor?: number | null;
};

export type DeliveryOrderResult =
  | { ok: true; order: any }
  | { ok: false; status: number; message: string };

export async function createDeliveryOrder(params: DeliveryOrderInput): Promise<DeliveryOrderResult> {
  const { unitId, customerId, customerName, customerPhone, orderType, items, notes, paymentMethod } = params;

  if (!items.length) return { ok: false, status: 400, message: 'Pedido vazio' };

  // 1. Validar produtos + estoque (igual dine_in)
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, unitId, active: true, available: true },
    include: { ingredients: { where: { optional: false }, include: { ingredient: true } } },
  });
  if (products.length !== productIds.length) {
    return { ok: false, status: 409, message: 'Algum produto está indisponível' };
  }

  const needed = new Map<string, { name: string; qty: number; stock: number; unit: string }>();
  for (const item of items) {
    const p = products.find((x: any) => x.id === item.productId)!;
    for (const pi of (p as any).ingredients || []) {
      const total = Number(pi.quantity) * item.quantity;
      const cur = needed.get(pi.ingredientId);
      if (cur) cur.qty += total;
      else needed.set(pi.ingredientId, {
        name: pi.ingredient.name, qty: total,
        stock: Number(pi.ingredient.stock), unit: pi.ingredient.unitOfMeasure,
      });
    }
  }
  for (const [, n] of needed) {
    if (n.qty > n.stock) {
      return { ok: false, status: 409, message: `Estoque insuficiente de "${n.name}"` };
    }
  }

  // 2. Endereço e taxa de entrega
  let deliveryFee = 0;
  let distanceKm: number | null = null;
  let customerLat: number | null = null;
  let customerLng: number | null = null;
  let deliveryAddress: string | null = null;

  if (orderType === 'delivery') {
    if (params.addressId) {
      const addr = await (prisma as any).deliveryAddress.findUnique({
        where: { id: params.addressId },
      });
      if (!addr || addr.customerId !== customerId) {
        return { ok: false, status: 400, message: 'Endereço inválido' };
      }
      if (!addr.lat || !addr.lng) {
        return { ok: false, status: 400, message: 'Endereço sem coordenadas. Recadastre com CEP válido.' };
      }
      customerLat = Number(addr.lat);
      customerLng = Number(addr.lng);
      deliveryAddress = [
        `${addr.street}, ${addr.number}`,
        addr.complement,
        addr.neighborhood,
        `${addr.city}/${addr.state || ''}`,
        addr.zipCode,
        addr.reference ? `Ref: ${addr.reference}` : null,
      ].filter(Boolean).join(' - ');
    } else if (params.customerLat && params.customerLng) {
      customerLat = params.customerLat;
      customerLng = params.customerLng;
      deliveryAddress = params.addressText || null;
    } else {
      return { ok: false, status: 400, message: 'Endereço de entrega obrigatório' };
    }

    // Calcula subtotal para frete grátis
    let subtotalPreview = 0;
    for (const it of items) {
      const p = products.find((x) => x.id === it.productId)!;
      subtotalPreview += Number(p.price) * it.quantity;
    }
    const quote = await calculateDeliveryFee({
      unitId, customerLat, customerLng, orderSubtotal: subtotalPreview,
    });
    if (quote.outOfRange) {
      return { ok: false, status: 400, message: `Endereço fora da área de entrega (${quote.distanceKm}km)` };
    }
    deliveryFee = quote.fee;
    distanceKm = quote.distanceKm;
  }

  // 3. Validar pedido mínimo
  const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
  let subtotal = 0;
  const itemsData = items.map((i) => {
    const p = products.find((x) => x.id === i.productId)!;
    const unitPrice = Number(p.price);
    const totalPrice = unitPrice * i.quantity;
    subtotal += totalPrice;
    return {
      productId: p.id, name: p.name, quantity: i.quantity,
      unitPrice, totalPrice, notes: i.notes || null, station: p.station,
    };
  });

  const minOrder = Number(unit?.deliveryMinOrder || 0);
  if (minOrder > 0 && subtotal < minOrder) {
    return { ok: false, status: 400, message: `Pedido mínimo de ${formatBRL(minOrder)}` };
  }

  const total = subtotal + deliveryFee; // serviceFee não se aplica em delivery/takeout
  const changeFor = paymentMethod === 'cash' && params.changeFor && params.changeFor > total
    ? params.changeFor : null;

  // 4. Mesa/sessão virtual
  const tableId = await getOrCreateDeliveryVirtualTable(unitId);
  const sessionId = await createDeliverySession({
    unitId, tableId, customerId, customerName, customerPhone,
  });

  // 5. Sequência
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const last = await prisma.order.findFirst({
    where: { unitId, createdAt: { gte: startOfDay } },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  const sequenceNumber = (last?.sequenceNumber || 0) + 1;

  // 6. Cria pedido + deduz estoque em transação
  const estimatedDeliveryAt = new Date(
    Date.now() + (Number(unit?.deliveryPrepTimeMin || 30) + Number(unit?.deliveryAvgTimeMin || 20)) * 60_000,
  );

  const order = await prisma.$transaction(async (tx: any) => {
    const created = await tx.order.create({
      data: {
        sessionId, unitId, tableId, sequenceNumber,
        status: 'received',
        subtotal, serviceFee: 0, deliveryFee, total,
        notes: notes || null,
        channel: 'delivery',
        orderType,
        customerId, customerName, customerPhone,
        deliveryAddress, customerLat, customerLng, distanceKm,
        estimatedDeliveryAt,
        paymentMethod,
        paymentStatus: paymentMethod === 'online' ? 'pending' : 'pending',
        changeFor,
        items: { create: itemsData },
      },
      include: { items: true, table: true, customer: true },
    });

    for (const [ingId, n] of needed) {
      await tx.ingredient.update({ where: { id: ingId }, data: { stock: { decrement: n.qty } } });
    }

    // Auto-deactivate products when any mandatory ingredient runs out
    await syncProductAvailability(tx, [...needed.keys()]);

    await tx.tableSession.update({
      where: { id: sessionId },
      data: { totalAmount: total },
    });

    // Atualiza estatísticas do customer
    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: total },
        lastSeenAt: new Date(),
      },
    });

    return created;
  });

  const payload = {
    ...serializeOrder(order),
    orderType,
    channel: 'delivery',
    deliveryFee,
    distanceKm,
    estimatedDeliveryAt,
    customerName,
    customerPhone,
    deliveryAddress,
    paymentMethod,
    paymentStatus: order.paymentStatus,
    changeFor,
  };

  // Para pagamento na entrega, o pedido já vai para a cozinha. Para online, aguarda webhook.
  if (paymentMethod !== 'online') {
    emitToKitchen(unitId, SocketEvents.ORDER_CREATED, payload);
    emitToWaiters(unitId, SocketEvents.ORDER_CREATED, payload);
    emitToDashboard(unitId, SocketEvents.ORDER_CREATED, payload);
  } else {
    emitToDashboard(unitId, SocketEvents.ORDER_CREATED, payload);
  }

  // WhatsApp confirmação
  sendDeliveryOrderConfirmation(unitId, order.id, payload).catch((err) => {
    console.error('[Delivery] Falha ao enviar confirmação WhatsApp:', err);
  });

  return { ok: true, order: payload };
}

async function sendDeliveryOrderConfirmation(unitId: string, orderId: string, order: any) {
  try {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } }) as any;
    if (!unit?.whatsappEnabled) return;

    const itemsList = order.items
      .map((i: any) => `• ${i.quantity}x ${i.name} (${formatBRL(i.totalPrice)})`)
      .join('\n');

    const typeEmoji = order.orderType === 'takeout' ? '🛍️' : '🛵';
    const typeLabel = order.orderType === 'takeout' ? 'Retirada no balcão' : 'Entrega em domicílio';
    const addressLine = order.orderType === 'delivery' && order.deliveryAddress
      ? `\n📍 *Endereço:* ${order.deliveryAddress}` : '';
    const feeLine = order.deliveryFee > 0
      ? `🛵 *Taxa de entrega:* ${formatBRL(order.deliveryFee)}\n` : '';
    const estTime = order.estimatedDeliveryAt
      ? new Date(order.estimatedDeliveryAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;
    const paymentLabel: Record<string, string> = {
      cash: 'Dinheiro (na entrega)',
      credit: 'Cartão de crédito (na entrega)',
      debit: 'Cartão de débito (na entrega)',
      pix: 'Pix (na entrega)',
      online: 'Pagamento online',
    };
    const changeLine = order.changeFor
      ? `\n💵 *Troco para:* ${formatBRL(order.changeFor)}` : '';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const trackingLink = appUrl ? `\n\n🔗 *Acompanhe:* ${appUrl}/t/${orderId}` : '';

    const message =
`${typeEmoji} *Pedido Confirmado - ${unit.name}*

Olá, *${order.customerName}*! Seu pedido foi recebido.

🔢 *Pedido:* #${order.sequenceNumber}
📦 *Tipo:* ${typeLabel}${addressLine}
${estTime ? `⏱️ *Previsão:* ${estTime}` : ''}

*Itens:*
${itemsList}

💰 *Subtotal:* ${formatBRL(order.subtotal)}
${feeLine}🏷️ *TOTAL:* ${formatBRL(order.total)}

💳 *Pagamento:* ${paymentLabel[order.paymentMethod] || order.paymentMethod}${changeLine}${trackingLink}

Obrigado! 🙌`;

    await whatsappService.sendMessage(unitId, order.customerPhone, message);
  } catch (err) {
    console.error('[Delivery] Erro ao montar mensagem WhatsApp:', err);
  }
}
