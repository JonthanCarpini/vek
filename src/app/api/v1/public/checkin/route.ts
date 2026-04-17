import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { checkinSchema } from '@/lib/validators';
import { signSession } from '@/lib/auth';
import { getStoreState } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, checkinSchema);
    if (!parsed.ok) return parsed.res;
    const { qrToken, name, phone } = parsed.data;

    const table = await prisma.tableEntity.findUnique({ where: { qrToken } });
    if (!table) return notFound('Mesa não encontrada');
    if (table.status === 'disabled') return fail('Mesa desativada', 403);
    if (table.status === 'reserved') return fail('Mesa reservada', 403);

    const state = await getStoreState(table.unitId);
    if (!state.open) return fail(state.reason || 'Loja fechada no momento', 403);

    // Upsert do cliente por (unitId, phone) para histórico.
    const customer = await prisma.customer.upsert({
      where: { unitId_phone: { unitId: table.unitId, phone } },
      update: { name, lastSeenAt: new Date() },
      create: { unitId: table.unitId, name, phone },
    });

    // Reutiliza sessão ativa ou cria nova
    let session = await prisma.tableSession.findFirst({
      where: { tableId: table.id, status: 'active' },
      orderBy: { openedAt: 'desc' },
    });

    if (!session) {
      session = await prisma.tableSession.create({
        data: {
          tableId: table.id,
          unitId: table.unitId,
          customerId: customer.id,
          customerName: name,
          customerPhone: phone,
          status: 'active',
        },
      });
      await prisma.tableEntity.update({
        where: { id: table.id },
        data: { status: 'occupied' },
      });
    } else if (!session.customerId) {
      // Sessão legada sem customerId: associa agora.
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { customerId: customer.id },
      });
    }

    const token = signSession({
      sid: session.id,
      tid: table.id,
      uid: table.unitId,
      name: session.customerName,
    });

    return ok({
      token,
      session: {
        id: session.id,
        tableNumber: table.number,
        tableLabel: table.label,
        customerName: session.customerName,
        openedAt: session.openedAt,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
