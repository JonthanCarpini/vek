import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, notFound, serverError, unauthorized } from '@/lib/api';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = getSessionFromRequest(req);
    if (!s) return unauthorized();
    const { id } = await params;
    const order = await prisma.order.findFirst({
      where: { id, sessionId: s.sid },
      include: { items: true, table: true },
    });
    if (!order) return notFound();
    return ok({ order });
  } catch (e) { return serverError(e); }
}
