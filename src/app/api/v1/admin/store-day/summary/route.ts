import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { getCurrentStoreDay } from '@/lib/store';

/**
 * GET /api/v1/admin/store-day/summary
 * Resumo financeiro do caixa do dia: entradas, saidas, vendas por metodo,
 * sessoes abertas/fechadas, ticket medio.
 */
export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.ANY_STAFF);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuario sem unidade', 400);
    const unitId = g.staff.unitId;

    const day = await getCurrentStoreDay(unitId);
    if (!day) {
      return ok({
        day: null,
        summary: {
          openingCash: 0, totalSales: 0, totalReceived: 0,
          byMethod: {}, sessionsClosed: 0, sessionsOpen: 0,
          avgTicket: 0, cashExpected: 0,
        },
      });
    }

    // Pagamentos do dia
    const payments = await prisma.sessionPayment.findMany({
      where: { storeDayId: day.id },
      select: { method: true, amount: true, changeGiven: true, sessionId: true },
    });

    const byMethod: Record<string, { count: number; amount: number; changeGiven: number }> = {};
    let totalReceived = 0;
    let totalChange = 0;
    const sessionIds = new Set<string>();
    for (const p of payments) {
      const amount = Number(p.amount);
      const change = Number(p.changeGiven);
      totalReceived += amount;
      totalChange += change;
      sessionIds.add(p.sessionId);
      const key = p.method;
      if (!byMethod[key]) byMethod[key] = { count: 0, amount: 0, changeGiven: 0 };
      byMethod[key].count += 1;
      byMethod[key].amount += amount;
      byMethod[key].changeGiven += change;
    }

    // Sessoes abertas (nao fechadas ainda) e fechadas hoje
    const sessionsOpen = await prisma.tableSession.count({
      where: { unitId, status: 'active', openedAt: { gte: day.openedAt } },
    });
    const sessionsClosed = await prisma.tableSession.count({
      where: { unitId, status: 'closed', closedAt: { gte: day.openedAt } },
    });

    // Vendas totais (total das sessoes fechadas neste dia)
    const closedSessions = await prisma.tableSession.findMany({
      where: { unitId, status: 'closed', closedAt: { gte: day.openedAt } },
      select: { totalAmount: true },
    });
    const totalSales = closedSessions.reduce((s, x) => s + Number(x.totalAmount), 0);

    const avgTicket = sessionsClosed > 0 ? totalSales / sessionsClosed : 0;

    // Caixa esperado: abertura + recebidos em dinheiro - troco
    const cashIn = byMethod.cash?.amount || 0;
    const cashChange = byMethod.cash?.changeGiven || 0;
    const cashExpected = Number(day.openingCash) + cashIn - cashChange;

    return ok({
      day,
      summary: {
        openingCash: Number(day.openingCash),
        totalSales,
        totalReceived,
        totalChange,
        byMethod,
        sessionsClosed,
        sessionsOpen,
        avgTicket,
        cashExpected,
      },
    });
  } catch (e) { return serverError(e); }
}
