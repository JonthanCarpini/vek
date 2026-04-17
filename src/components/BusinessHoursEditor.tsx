'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function BusinessHoursEditor() {
  const [rows, setRows] = useState<any[]>(
    DAYS.map((_, weekday) => ({ weekday, openTime: '10:00', closeTime: '23:00', active: false })),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const d = await apiFetch('/api/v1/admin/business-hours');
      if (d.hours?.length) {
        const map: Record<number, any> = {};
        d.hours.forEach((h: any) => { map[h.weekday] = h; });
        setRows(DAYS.map((_, weekday) => map[weekday] || { weekday, openTime: '10:00', closeTime: '23:00', active: false }));
      }
    } catch (e: any) { setMsg(e.message); }
  }

  function update(idx: number, patch: any) {
    setRows((r) => r.map((x, i) => i === idx ? { ...x, ...patch } : x));
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      await apiFetch('/api/v1/admin/business-hours', {
        method: 'PUT',
        body: JSON.stringify({ hours: rows.filter((r) => r.active).map((r) => ({
          weekday: r.weekday, openTime: r.openTime, closeTime: r.closeTime, active: true,
        })) }),
      });
      setMsg('Horários salvos.');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="font-semibold">Horário de funcionamento</div>
      <div className="text-xs text-gray-400">Marque os dias ativos e informe abertura/fechamento. Fora do horário o checkin das mesas é bloqueado.</div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.weekday} className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 w-20">
              <input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} />
              <span>{DAYS[r.weekday]}</span>
            </label>
            <input type="time" className="input w-32" value={r.openTime} onChange={(e) => update(i, { openTime: e.target.value })} />
            <span>até</span>
            <input type="time" className="input w-32" value={r.closeTime} onChange={(e) => update(i, { closeTime: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? 'Salvando...' : 'Salvar horários'}</button>
        {msg && <span className="text-sm text-gray-300">{msg}</span>}
      </div>
    </div>
  );
}
