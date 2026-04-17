import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError, notFound } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const { id } = await params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.unitId !== g.staff.unitId) return notFound();

    const sessions = await prisma.tableSession.findMany({
      where: { customerId: id },
      orderBy: { openedAt: 'desc' },
      take: 30,
      include: {
        table: { select: { number: true } },
        orders: {
          select: { id: true, total: true, sequenceNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return ok({
      customer: {
        ...customer,
        totalSpent: Number(customer.totalSpent),
        avgTicket: customer.totalOrders > 0 ? Number(customer.totalSpent) / customer.totalOrders : 0,
      },
      sessions: sessions.map((s: any) => ({
        id: s.id,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        totalAmount: Number(s.totalAmount),
        tableNumber: s.table?.number,
        orders: s.orders.map((o: any) => ({ ...o, total: Number(o.total) })),
      })),
    });
  } catch (e) { return serverError(e); }
}
