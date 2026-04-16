import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError, notFound } from '@/lib/api';
import { checkinSchema } from '@/lib/validators';
import { signSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, checkinSchema);
    if (!parsed.ok) return parsed.res;
    const { qrToken, name, phone } = parsed.data;

    const table = await prisma.tableEntity.findUnique({ where: { qrToken } });
    if (!table) return notFound('Mesa não encontrada');
    if (table.status === 'disabled') return fail('Mesa desativada', 403);

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
          customerName: name,
          customerPhone: phone,
          status: 'active',
        },
      });
      await prisma.tableEntity.update({
        where: { id: table.id },
        data: { status: 'occupied' },
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
