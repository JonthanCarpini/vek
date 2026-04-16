import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, notFound, serverError, unauthorized } from '@/lib/api';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const session = await prisma.tableSession.findUnique({
      where: { id: s.sid },
      include: {
        orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        table: true,
      },
    });
    if (!session) return notFound();

    const subtotal = session.orders.reduce((acc, o) => acc + Number(o.subtotal), 0);
    const serviceFee = session.orders.reduce((acc, o) => acc + Number(o.serviceFee), 0);
    const total = subtotal + serviceFee;

    return ok({
      session: {
        id: session.id,
        status: session.status,
        openedAt: session.openedAt,
        customerName: session.customerName,
        tableNumber: session.table.number,
      },
      totals: { subtotal, serviceFee, total },
      orders: session.orders.map((o) => ({
        id: o.id, sequenceNumber: o.sequenceNumber, status: o.status,
        total: Number(o.total), createdAt: o.createdAt,
        items: o.items.map((i) => ({
          name: i.name, quantity: i.quantity, totalPrice: Number(i.totalPrice),
        })),
      })),
    });
  } catch (e) { return serverError(e); }
}
