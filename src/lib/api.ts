import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}
export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}
export function unauthorized(message = 'Não autorizado') {
  return fail(message, 401);
}
export function forbidden(message = 'Acesso negado') {
  return fail(message, 403);
}
export function notFound(message = 'Não encontrado') {
  return fail(message, 404);
}
export function serverError(e: unknown) {
  console.error('[API][ERROR]', e);
  const msg = e instanceof Error ? e.message : 'Erro interno';
  return fail(msg, 500);
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  try {
    const raw = await req.json();
    const data = schema.parse(raw);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, res: fail('Dados inválidos', 422, e.flatten()) };
    }
    return { ok: false, res: fail('JSON inválido', 400) };
  }
}
