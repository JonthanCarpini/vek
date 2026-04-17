import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError, unauthorized, notFound } from '@/lib/api';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();

    const session = await prisma.tableSession.findUnique({
      where: { id: s.sid },
      include: { 
        orders: { 
          where: { 
            status: { not: 'cancelled' } 
          } 
        } 
      },
    });

    if (!session) return notFound('Sessão não encontrada');
    if (session.status !== 'active') return fail('Sessão não está ativa', 400);

    // Se houver pedidos não cancelados, não permite sair sem pagar
    if (session.orders.length > 0) {
      return fail('Não é possível sair da mesa pois há pedidos ativos. Solicite o fechamento da conta.', 403);
    }

    // Cancela a sessão e libera a mesa
    await prisma.$transaction([
      prisma.tableSession.update({
        where: { id: s.sid },
        data: { status: 'cancelled', closedAt: new Date() },
      }),
      prisma.tableEntity.update({
        where: { id: session.tableId },
        data: { status: 'free' },
      }),
    ]);

    return ok({ message: 'Saída realizada com sucesso' });
  } catch (e) {
    return serverError(e);
  }
}
