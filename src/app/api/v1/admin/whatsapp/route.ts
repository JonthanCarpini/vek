import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';
import { whatsappService } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return fail('unidade não encontrada');

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { whatsappEnabled: true, whatsappStatus: true, whatsappSession: true }
    });

    return ok({ ...unit });
  } catch (e) { return serverError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const unitId = g.staff.unitId;
    if (!unitId) return fail('unidade não encontrada');

    const { action, enabled } = await req.json();

    if (action === 'toggle') {
      await prisma.unit.update({
        where: { id: unitId },
        data: { whatsappEnabled: !!enabled }
      });
      if (enabled) {
        whatsappService.initialize(unitId);
      } else {
        await whatsappService.disconnect(unitId);
      }
      return ok({ enabled });
    }

    if (action === 'disconnect') {
      await whatsappService.disconnect(unitId);
      return ok({ disconnected: true });
    }

    if (action === 'reconnect') {
      await whatsappService.disconnect(unitId);
      whatsappService.initialize(unitId);
      return ok({ reconnecting: true });
    }

    return fail('ação inválida');
  } catch (e) { return serverError(e); }
}
