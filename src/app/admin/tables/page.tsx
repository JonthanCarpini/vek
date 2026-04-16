'use client';
import { useEffect, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';

export default function Tables() {
  const [tables, setTables] = useState<any[]>([]);
  const [form, setForm] = useState({ number: '', label: '', capacity: 4 });
  const [qr, setQr] = useState<{ id: string; number: number; url: string } | null>(null);

  useEffect(() => { load(); }, []);
  async function load() { try { const d = await apiFetch('/api/v1/admin/tables'); setTables(d.tables); } catch {} }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/api/v1/admin/tables', {
        method: 'POST',
        body: JSON.stringify({ number: Number(form.number), label: form.label || null, capacity: Number(form.capacity) }),
      });
      setForm({ number: '', label: '', capacity: 4 }); load();
    } catch (e: any) { alert(e.message); }
  }
  async function disable(id: string) {
    if (!confirm('Desabilitar mesa?')) return;
    try { await apiFetch(`/api/v1/admin/tables/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }
  function openQR(t: any) {
    const staff = loadStaff();
    const url = `/api/v1/admin/tables/${t.id}/qr?t=${staff?.token}`;
    setQr({ id: t.id, number: t.number, url });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Mesas & QR Codes</h1>
      <form onSubmit={create} className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input className="input" type="number" placeholder="Número" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
        <input className="input" placeholder="Etiqueta (opcional)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input className="input" type="number" placeholder="Capacidade" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
        <button className="btn btn-primary">Adicionar mesa</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tables.map((t: any) => (
          <div key={t.id} className="card p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">Mesa {t.number}</div>
                <div className="text-xs text-gray-400">{t.label || '—'} • {t.capacity} lug.</div>
              </div>
              <span className={`badge ${t.status === 'occupied' ? 'badge-warn' : t.status === 'disabled' ? '' : 'badge-ok'}`}>{t.status}</span>
            </div>
            {t.sessions?.[0] && (
              <div className="mt-2 text-xs text-gray-400">
                {t.sessions[0].customerName} • R$ {Number(t.sessions[0].totalAmount).toFixed(2)}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => openQR(t)} className="btn btn-ghost text-sm flex-1">QR Code</button>
              <button onClick={() => disable(t.id)} className="btn btn-ghost text-sm text-red-400">Desabilitar</button>
            </div>
          </div>
        ))}
      </div>

      {qr && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setQr(null)}>
          <div className="card p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-bold mb-4">QR — Mesa {qr.number}</div>
            <img src={qr.url} alt="QR" className="w-80 h-80 bg-white p-3 rounded" />
            <div className="mt-4 flex gap-2 justify-center">
              <a href={qr.url} download={`mesa-${qr.number}.png`} className="btn btn-primary">Baixar PNG</a>
              <button onClick={() => window.print()} className="btn btn-ghost">Imprimir</button>
              <button onClick={() => setQr(null)} className="btn btn-ghost">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
