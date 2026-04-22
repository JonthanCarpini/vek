import { NextRequest, NextResponse } from 'next/server';
import { pollOnce } from '@/lib/ifood/events';
import { isIfoodConfigured } from '@/lib/ifood/client';

/**
 * Endpoint interno de polling iFood.
 * Protegido pelo header `x-internal-secret` (usa JWT_SECRET como chave).
 * Chamado por um setInterval no server.js custom (bootstrap do processo).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (!secret || secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isIfoodConfigured())) {
    return NextResponse.json({ skipped: true, reason: 'credentials_missing' });
  }

  try {
    await pollOnce();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[iFood] Erro no endpoint de polling:', err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

// Desabilita cache para esse endpoint
export const dynamic = 'force-dynamic';
