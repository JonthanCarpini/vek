'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveStaff } from '@/lib/staff-client';

export const dynamic = 'force-dynamic';

function AdminLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/admin';
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || 'Erro');
      saveStaff(j.data);
      router.push(next);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm">
        <div className="text-2xl font-bold mb-6">🍔 Backoffice</div>
        <label className="label">E-mail</label>
        <input className="input mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="label">Senha</label>
        <input className="input mb-5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <div className="text-red-400 text-sm mb-3">{err}</div>}
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center p-5"><div className="text-gray-400">Carregando...</div></main>}>
      <AdminLoginInner />
    </Suspense>
  );
}
