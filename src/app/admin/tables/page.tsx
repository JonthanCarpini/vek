'use client';
import { useEffect, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';

type QRState = { id: string; number: number; imgUrl: string; link: string; qrToken: string };

const STATUS_LABEL: Record<string, string> = {
  free: 'Livre', occupied: 'Ocupada', reserved: 'Reservada', disabled: 'Desabilitada',
};
const STATUS_COLOR: Record<string, string> = {
  free: 'badge-ok', occupied: 'badge-warn', reserved: 'badge-info', disabled: '',
};

export default function Tables() {
  const [tables, setTables] = useState<any[]>([]);
  const [form, setForm] = useState({ number: '', label: '', capacity: 4 });
  const [qr, setQr] = useState<QRState | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

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

  async function setStatus(id: string, status: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      await apiFetch(`/api/v1/admin/tables/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      load();
    } catch (e: any) { alert(e.message); }
  }

  function openQR(t: any) {
    const staff = loadStaff();
    const imgUrl = `/api/v1/admin/tables/${t.id}/qr?t=${staff?.token}`;
    const link = `${window.location.origin}/m/${t.qrToken}`;
    setQr({ id: t.id, number: t.number, imgUrl, link, qrToken: t.qrToken });
  }

  async function copyLink() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.link);
      setCopyMsg('Link copiado!');
      setTimeout(() => setCopyMsg(''), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = qr.link; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); setCopyMsg('Link copiado!'); } catch { setCopyMsg('Copie manualmente'); }
      document.body.removeChild(ta);
      setTimeout(() => setCopyMsg(''), 2000);
    }
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
        {tables.map((t: any) => {
          const isDisabled = t.status === 'disabled';
          const isOccupied = t.status === 'occupied';
          const isReserved = t.status === 'reserved';
          const isFree = t.status === 'free';
          return (
            <div key={t.id} className="card p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xl font-bold">Mesa {t.number}</div>
                  <div className="text-xs text-gray-400">{t.label || '—'} • {t.capacity} lug.</div>
                </div>
                <span className={`badge ${STATUS_COLOR[t.status] || ''}`}>{STATUS_LABEL[t.status] || t.status}</span>
              </div>
              {t.sessions?.[0] && (
                <div className="mt-2 text-xs text-gray-400">
                  {t.sessions[0].customerName} • {formatBRL(t.sessions[0].totalAmount)}
                </div>
              )}
              <div className="flex gap-1 mt-3 flex-wrap">
                <button onClick={() => openQR(t)} className="btn btn-ghost text-xs px-2 flex-1">QR Code</button>
                {isOccupied && (
                  <button onClick={() => setStatus(t.id, 'free', 'Desocupar mesa? A sessão ativa será fechada.')}
                    className="btn btn-ghost text-xs px-2 text-yellow-400">Desocupar</button>
                )}
                {(isFree || isReserved) && (
                  <button onClick={() => setStatus(t.id, isReserved ? 'free' : 'reserved')}
                    className="btn btn-ghost text-xs px-2 text-blue-400">
                    {isReserved ? 'Liberar' : 'Reservar'}
                  </button>
                )}
                {isDisabled ? (
                  <button onClick={() => setStatus(t.id, 'free')} className="btn btn-ghost text-xs px-2 text-green-400">Habilitar</button>
                ) : (
                  <button onClick={() => setStatus(t.id, 'disabled', 'Desabilitar mesa?')} className="btn btn-ghost text-xs px-2 text-red-400">Desabilitar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {qr && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setQr(null)}>
          <div className="card p-6 text-center max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-bold mb-4">QR — Mesa {qr.number}</div>
            <img src={qr.imgUrl} alt="QR" className="w-80 h-80 bg-white p-3 rounded mx-auto" />
            <div className="mt-3 text-xs text-gray-400 break-all bg-[#0b0b0f] p-2 rounded border border-[color:var(--border)]">{qr.link}</div>
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              <button onClick={copyLink} className="btn btn-primary">📋 Copiar link</button>
              <a href={qr.imgUrl} download={`mesa-${qr.number}.png`} className="btn btn-ghost">Baixar PNG</a>
              <button onClick={() => window.print()} className="btn btn-ghost">Imprimir</button>
              <button onClick={() => setQr(null)} className="btn btn-ghost">Fechar</button>
            </div>
            {copyMsg && <div className="mt-3 text-sm text-green-400">{copyMsg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
