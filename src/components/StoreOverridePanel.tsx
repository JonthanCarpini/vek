'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

const REASONS = [
  'Fechamento temporário',
  'Fim do expediente',
  'Manutenção',
  'Falta de insumos',
  'Feriado',
  'Outro motivo',
];

export function StoreOverridePanel() {
  const [active, setActive] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [type, setType] = useState<'open' | 'closed'>('closed');
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const d = await apiFetch('/api/v1/admin/store-override');
      setActive(d.active); setRecent(d.recent);
    } catch (e: any) { setMsg(e.message); }
  }

  async function apply() {
    setBusy(true); setMsg(null);
    try {
      const finalReason = reason === 'Outro motivo' ? customReason : reason;
      if (!finalReason || finalReason.length < 2) throw new Error('Informe o motivo');
      await apiFetch('/api/v1/admin/store-override', {
        method: 'POST',
        body: JSON.stringify({
          type,
          reason: finalReason,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      });
      setMsg('Override aplicado.');
      setEndsAt(''); setCustomReason('');
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function clearOverride() {
    if (!confirm('Encerrar override atual?')) return;
    setBusy(true); setMsg(null);
    try {
      await apiFetch('/api/v1/admin/store-override', { method: 'DELETE' });
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="font-semibold">Abrir / fechar manualmente</div>

      {active ? (
        <div className={`p-3 rounded border ${active.type === 'closed' ? 'border-red-500/50 bg-red-950/30' : 'border-green-500/50 bg-green-950/30'}`}>
          <div className="text-sm">
            <b>{active.type === 'closed' ? 'LOJA FECHADA' : 'LOJA ABERTA'}</b> · {active.reason}
          </div>
          {active.endsAt && <div className="text-xs text-gray-400">Até {new Date(active.endsAt).toLocaleString('pt-BR')}</div>}
          <button onClick={clearOverride} disabled={busy} className="btn btn-ghost text-xs mt-2">Encerrar agora</button>
        </div>
      ) : (
        <div className="text-sm text-gray-400">Sem override ativo. A loja segue os horários cadastrados.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Ação</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
            <option value="closed">Fechar loja</option>
            <option value="open">Forçar abertura</option>
          </select>
        </div>
        <div>
          <label className="label">Motivo</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {reason === 'Outro motivo' && (
          <div className="md:col-span-2">
            <label className="label">Descreva o motivo</label>
            <input className="input" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
          </div>
        )}
        <div className="md:col-span-2">
          <label className="label">Termina em (opcional)</label>
          <input type="datetime-local" className="input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={apply} disabled={busy} className="btn btn-primary">Aplicar</button>
        {msg && <span className="text-sm text-gray-300">{msg}</span>}
      </div>

      {recent.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Histórico recente</div>
          <div className="space-y-1 text-xs">
            {recent.slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between border-b border-gray-800 pb-1">
                <span>{r.type === 'closed' ? '🔒' : '🔓'} {r.reason}</span>
                <span className="text-gray-500">{new Date(r.startsAt).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
