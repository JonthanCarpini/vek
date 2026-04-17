import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { resolve, sep } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = resolve(process.cwd(), 'public', 'uploads');

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const rel = path.join('/');
    const full = resolve(ROOT, rel);
    if (!full.startsWith(ROOT + sep) && full !== ROOT) {
      return new NextResponse('forbidden', { status: 403 });
    }
    const st = await stat(full);
    if (!st.isFile()) return new NextResponse('not found', { status: 404 });
    const ext = (rel.split('.').pop() || '').toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const buf = await readFile(full);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(st.size),
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('not found', { status: 404 });
  }
}
