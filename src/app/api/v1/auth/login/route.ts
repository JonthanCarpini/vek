import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, parseBody, serverError } from '@/lib/api';
import { loginSchema } from '@/lib/validators';
import { comparePassword, signStaff, StaffRole } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, loginSchema);
    if (!parsed.ok) return parsed.res;
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.active) return fail('Credenciais inválidas', 401);
    const okPwd = await comparePassword(parsed.data.password, user.passwordHash);
    if (!okPwd) return fail('Credenciais inválidas', 401);
    const token = signStaff({
      sub: user.id, role: user.role as StaffRole, unitId: user.unitId, name: user.name,
    });
    return ok({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, unitId: user.unitId },
    });
  } catch (e) { return serverError(e); }
}
