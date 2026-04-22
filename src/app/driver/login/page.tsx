'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Loader2 } from 'lucide-react';

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/driver/auth/me')
      .then((r) => r.ok && router.replace('/driver'))
      .finally(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/driver/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message || body.error || 'Erro ao entrar');
        return;
      }
      router.replace('/driver');
    } catch (err: any) {
      setError(err.message || 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-full bg-orange-500/20 items-center justify-center mb-3">
            <Bike className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold">Área do Entregador</h1>
          <p className="text-sm text-gray-400 mt-1">Entre com seu telefone e PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Telefone (WhatsApp)</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="input w-full"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="input w-full text-center tracking-[0.5em] text-xl font-mono"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-600/10 border border-red-500/30 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !phone || pin.length < 4}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            PIN não cadastrado? Peça ao administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
