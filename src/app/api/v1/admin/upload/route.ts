import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { requireStaff, ROLES } from '@/lib/guard';
import { fail, ok, serverError } from '@/lib/api';

export const runtime = 'nodejs';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const g = requireStaff(req, ROLES.MANAGER_UP);
    if (!g.ok) return g.res;

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('Arquivo ausente', 400);
    if (!ALLOWED.includes(file.type)) return fail(`Tipo ${file.type} não permitido`, 400);
    if (file.size > MAX_BYTES) return fail('Máximo 5 MB', 400);

    const ext = ({
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
      'image/gif': 'gif', 'image/svg+xml': 'svg',
    } as Record<string, string>)[file.type] || 'bin';

    const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, name), buf);

    return ok({ url: `/uploads/${name}`, size: file.size, type: file.type });
  } catch (e) { return serverError(e); }
}
