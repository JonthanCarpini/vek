import { NextRequest } from 'next/server';
import { ok, fail, serverError } from '@/lib/api';
import { lookupZipCode } from '@/lib/delivery/geocoding';

/**
 * GET /api/v1/delivery/zipcode/[cep]
 * Proxy para ViaCEP com cache no client-side (sem quota).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ cep: string }> }) {
  try {
    const { cep } = await params;
    const result = await lookupZipCode(cep);
    if (!result) return fail('CEP não encontrado', 404);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = 'force-dynamic';
