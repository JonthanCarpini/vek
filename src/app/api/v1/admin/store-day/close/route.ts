import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { closeStoreDaySchema } from '@/lib/validators';
import { getCurrentStoreDay } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.CASHIER);
    if (!g.ok) return g.res;
    if (!g.staff.unitId) return fail('Usuário sem unidade', 400);
    const current = await getCurrentStoreDay(g.staff.unitId);
    if (!current) return fail('Nenhum caixa aberto', 404);

    // Impede fechamento com mesas ainda abertas
    const openSessions = await prisma.tableSession.count({
      where: { unitId: g.staff.unitId, status: 'active' },
    });
    if (openSessions > 0) return fail(`Existem ${openSessions} mesa(s) abertas. Feche as contas antes.`, 409);

    const p = await parseBody(req, closeStoreDaySchema);
    if (!p.ok) return p.res;

    // Totais em dinheiro (para conferência de diferença)
    const cashAgg = await prisma.sessionPayment.aggregate({
      where: { storeDayId: current.id, method: 'cash' },
      _sum: { amount: true, changeGiven: true },
    });
    const totalAgg = await prisma.sessionPayment.aggregate({
      where: { storeDayId: current.id },
      _sum: { amount: true },
    });
    const cashIn = Number(cashAgg._sum.amount || 0) - Number(cashAgg._sum.changeGiven || 0);
    const expectedCash = Number(current.openingCash) + cashIn;
    const totalSales = Number(totalAgg._sum.amount || 0);
    const cashDiff = p.data.closingCash - expectedCash;

    const day = await prisma.storeDay.update({
      where: { id: current.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: g.staff.sub,
        closingCash: p.data.closingCash,
        expectedCash,
        cashDiff,
        totalSales,
        notes: p.data.notes ?? current.notes,
      },
    });
    return ok({ day });
  } catch (e) { return serverError(e); }
}
