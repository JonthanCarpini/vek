import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { fail, notFound, serverError } from '@/lib/api';
import { requireStaff, ROLES } from '@/lib/guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;
    const { id } = await params;
    const t = await prisma.tableEntity.findUnique({ where: { id } });
    if (!t) return notFound();
    const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const url = `${base}/m/${t.qrToken}`;
    const format = req.nextUrl.searchParams.get('format') || 'png';
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 512 });
      return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
    }
    const buf = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 512 });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="mesa-${t.number}.png"`,
      },
    });
  } catch (e) { return serverError(e); }
}
