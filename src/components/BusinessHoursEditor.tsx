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

  function copyToAll(idx: number) {
    setRows((r) => r.map((x) => ({ ...x, openTime: r[idx].openTime, closeTime: r[idx].closeTime })));
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="font-semibold">Horário de funcionamento</div>
      <div className="text-xs text-gray-400">
        Marque os dias ativos. Para turnos que atravessam a meia-noite (ex.: Sáb 18:00 → Dom 02:00),
        basta colocar fechamento menor que abertura — o sistema entende que vira o dia.
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const crosses = r.active && r.closeTime <= r.openTime && r.closeTime !== r.openTime;
          return (
            <div key={r.weekday} className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 w-24">
                <input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} />
                <span className="font-semibold">{DAYS[r.weekday]}</span>
              </label>
              <input type="time" className="input w-32" value={r.openTime} onChange={(e) => update(i, { openTime: e.target.value })} disabled={!r.active} />
              <span className="text-gray-500">até</span>
              <input type="time" className="input w-32" value={r.closeTime} onChange={(e) => update(i, { closeTime: e.target.value })} disabled={!r.active} />
              {crosses && <span className="text-xs text-amber-400">🌙 vira o dia</span>}
              {r.active && (
                <button type="button" onClick={() => copyToAll(i)} className="text-xs text-brand-400 hover:underline ml-auto">
                  Copiar p/ todos
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? 'Salvando...' : 'Salvar horários'}</button>
        {msg && <span className="text-sm text-gray-300">{msg}</span>}
      </div>
    </div>
  );
}
