import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, parseBody, serverError } from '@/lib/api';
import { tableSchema } from '@/lib/validators';
import { requireStaff, ROLES } from '@/lib/guard';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const p = await parseBody(req, tableSchema.partial());
    if (!p.ok) return p.res;
    const data = p.data as any;

    // Se estiver liberando a mesa e houver sessão ativa, fecha a sessão.
    if (data.status === 'free') {
      const openSession = await prisma.tableSession.findFirst({
        where: { tableId: id, closedAt: null },
      });
      if (openSession) {
        await prisma.tableSession.update({
          where: { id: openSession.id },
          data: { closedAt: new Date(), status: 'closed' },
        });
      }
    }

    const t = await prisma.tableEntity.update({ where: { id }, data });
    return ok({ table: t });
  } catch (e) { return serverError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    // Se a mesa nunca teve sessões, pode ser excluída. Caso contrário, apenas desabilita.
    const count = await prisma.tableSession.count({ where: { tableId: id } });
    if (count === 0) {
      await prisma.tableEntity.delete({ where: { id } });
      return ok({ deleted: true });
    }
    await prisma.tableEntity.update({ where: { id }, data: { status: 'disabled' } });
    return ok({ deleted: false, disabled: true });
  } catch (e) { return serverError(e); }
}
