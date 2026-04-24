import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

/**
 * Lista pedidos para o painel Admin.
 * Filtros: ?status=<status|all> & ?channel=<dine-in|delivery|ifood|all>
 * Retorna campos enriquecidos para exibir info de delivery/iFood
 * (endereço, motoboy, tipo de entrega, pagamento).
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId || req.nextUrl.searchParams.get('unitId');
    if (!unitId) return fail('unitId necessário', 400);

    const statusParam = req.nextUrl.searchParams.get('status');
    const channelParam = req.nextUrl.searchParams.get('channel');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10), 500);

    // Frontend usa 'dine-in', DB armazena 'dine_in'
    const channelDbMap: Record<string, string> = { 'dine-in': 'dine_in' };
    const channelDb = channelParam ? (channelDbMap[channelParam] ?? channelParam) : null;

    const where: any = { unitId };
    if (statusParam && statusParam !== 'all') where.status = statusParam;
    if (channelDb && channelDb !== 'all') where.channel = channelDb;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        items: true,
        table: { select: { number: true, label: true, virtual: true } },
        session: { select: { customerName: true } },
        driver: { select: {
          id: true, name: true, phone: true,
          currentLat: true, currentLng: true, lastLocationAt: true,
        } },
      } as any,
    }) as any[];

    // Serializa Decimal → number para evitar precisão de string no cliente
    const mapped = orders.map((o: any) => ({
      id: o.id,
      sequenceNumber: o.sequenceNumber,
      status: o.status,
      channel: (o.channel === 'dine_in' ? 'dine-in' : o.channel) || 'dine-in',
      orderType: o.orderType || null,
      subtotal: Number(o.subtotal ?? 0),
      deliveryFee: Number(o.deliveryFee ?? 0),
      total: Number(o.total ?? 0),
      paymentMethod: o.paymentMethod || null,
      paymentStatus: o.paymentStatus || null,
      changeFor: o.changeFor != null ? Number(o.changeFor) : null,
      customerName: o.customerName || o.session?.customerName || null,
      customerPhone: o.customerPhone || null,
      deliveryAddress: o.deliveryAddress || null,
      deliveryLat: o.deliveryLat != null ? Number(o.deliveryLat) : null,
      deliveryLng: o.deliveryLng != null ? Number(o.deliveryLng) : null,
      distanceKm: o.distanceKm != null ? Number(o.distanceKm) : null,
      estimatedDeliveryAt: o.estimatedDeliveryAt,
      dispatchedAt: o.dispatchedAt,
      deliveredAt: o.deliveredAt,
      notes: o.notes,
      createdAt: o.createdAt,
      table: o.table,
      session: o.session,
      driver: o.driver ? {
        id: o.driver.id,
        name: o.driver.name,
        phone: o.driver.phone,
        currentLat: o.driver.currentLat != null ? Number(o.driver.currentLat) : null,
        currentLng: o.driver.currentLng != null ? Number(o.driver.currentLng) : null,
        lastLocationAt: o.driver.lastLocationAt,
      } : null,
      items: o.items.map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice ?? 0),
        totalPrice: Number(i.totalPrice ?? 0),
        notes: i.notes,
      })),
    }));

    return ok({ orders: mapped });
  } catch (e) { return serverError(e); }
}
