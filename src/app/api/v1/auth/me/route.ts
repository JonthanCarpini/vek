import { NextRequest } from 'next/server';
import { ok, unauthorized } from '@/lib/api';
import { getStaffFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const s = getStaffFromRequest(req);
  if (!s) return unauthorized();
  return ok({ user: s });
}
