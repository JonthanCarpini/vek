import { NextRequest } from 'next/server';
import { ok, serverError, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireCustomer } from '@/lib/guard';
import { createDeliveryOrder } from '@/lib/delivery/orders';
import { z } from 'zod';

/**
 * GET /api/v1/delivery/orders
 * Lista pedidos do cliente autenticado (mais recentes primeiro).
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireCustomer(req);
    if (!g.ok) return g.res;

    const orders = await prisma.order.findMany({
      where: { customerId: g.customer.sub } as any,
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { items: true },
    });

    return ok({
      orders: orders.map((o: any) => ({
        id: o.id,
        sequenceNumber: o.sequenceNumber,
        status: o.status,
        orderType: o.orderType,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        total: Number(o.total),
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        estimatedDeliveryAt: o.estimatedDeliveryAt,
        deliveredAt: o.deliveredAt,
        items: o.items.map((i: any) => ({
          id: i.id, name: i.name, quantity: i.quantity, totalPrice: Number(i.totalPrice),
        })),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  orderType: z.enum(['delivery', 'takeout']),
  items: z.array(itemSchema).min(1),
  notes: z.string().trim().max(500).optional(),
  addressId: z.string().optional(),
  paymentMethod: z.enum(['cash', 'credit', 'debit', 'pix', 'online']),
  changeFor: z.number().min(0).optional(),
});

/**
 * POST /api/v1/delivery/orders
 * Cria um novo pedido de delivery/takeout.
 */
export async function POST(req: NextRequest) {
  try {
    const g = requireCustomer(req);
    if (!g.ok) return g.res;

    const p = await parseBody(req, createSchema);
    if (!p.ok) return p.res;

    // Busca dados atualizados do customer (nome pode ter mudado)
    const customer = await prisma.customer.findUnique({
      where: { id: g.customer.sub },
    });
    if (!customer) return fail('Cliente não encontrado', 404);

    const result = await createDeliveryOrder({
      unitId: g.customer.uid,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      orderType: p.data.orderType,
      items: p.data.items,
      notes: p.data.notes,
      addressId: p.data.addressId,
      paymentMethod: p.data.paymentMethod,
      changeFor: p.data.changeFor,
    });

    if (!result.ok) return fail(result.message, result.status);
    return ok({ order: result.order });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
