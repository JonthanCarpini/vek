'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';
import { CashierSessionModal } from '@/components/CashierSessionModal';
import { CashierSummaryCard } from '@/components/CashierSummaryCard';

export default function CashierPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [day, setDay] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [modal, setModal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/cashier'); return; }
    setStaff(s);
    load();
    loadDay();
    loadSummary();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:dashboard`]);
    const sock = getSocket();
    const r = () => { load(); loadSummary(); };
    sock.on('order.created', r);
    sock.on('order.updated', r);
    sock.on('order.status_changed', r);
    sock.on('session.closed', r);
    sock.on('session.payment_added', r);
    sock.on('session.payment_removed', r);
    const id = setInterval(load, 15000);
    return () => {
      sock.off('order.created', r); sock.off('order.updated', r); sock.off('order.status_changed', r);
      sock.off('session.closed', r); sock.off('session.payment_added', r); sock.off('session.payment_removed', r);
      clearInterval(id);
    };
  }, []);

  async function load() {
    try { const d = await apiFetch('/api/v1/cashier/sessions'); setSessions(d.sessions); } catch {}
  }
  async function loadDay() {
    try { const d = await apiFetch('/api/v1/admin/store-day'); setDay(d.current); } catch {}
  }
  async function loadSummary() {
    try { const d = await apiFetch('/api/v1/admin/store-day/summary'); setSummary(d.summary); }
    catch {}
  }

  async function openDay(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await apiFetch('/api/v1/admin/store-day', {
        method: 'POST',
        body: JSON.stringify({ openingCash: Number((openingCash || '0').replace(',', '.')) }),
      });
      setOpeningCash(''); await loadDay();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function closeDay() {
    const remaining = sessions.length;
    if (remaining > 0) { alert(`Feche primeiro as ${remaining} mesa(s) abertas.`); return; }
    if (!closingCash) { alert('Informe o valor em caixa no fechamento.'); return; }
    if (!confirm('Fechar o caixa do dia?')) return;
    setBusy(true); setErr(null);
    try {
      const d = await apiFetch('/api/v1/admin/store-day/close', {
        method: 'POST',
        body: JSON.stringify({ closingCash: Number(closingCash.replace(',', '.')) }),
      });
      setClosingCash('');
      alert(`Caixa fechado.\nVendas: ${formatBRL(d.day.totalSales)}\nEsperado: ${formatBRL(d.day.expectedCash)}\nDiferença: ${formatBRL(d.day.cashDiff)}`);
      await loadDay();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function logout() { localStorage.removeItem('md:staff'); router.push('/admin/login'); }

  return (
    <main className="min-h-screen p-4">
      <header className="flex justify-between items-center mb-5">
        <div>
          <div className="text-2xl font-bold">💰 Caixa</div>
          <div className="text-sm text-gray-400">{staff?.user?.name}</div>
        </div>
        <button onClick={logout} className="btn btn-ghost">Sair</button>
      </header>

      {/* Painel do dia operacional */}
      <section className="card p-4 mb-5">
        {day ? (
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div>
              <div className="text-xs text-gray-500">CAIXA ABERTO</div>
              <div className="text-lg font-semibold">desde {new Date(day.openedAt).toLocaleString('pt-BR')}</div>
              <div className="text-sm text-gray-400">Abertura: {formatBRL(day.openingCash)}</div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="label">Valor em caixa (fechamento)</label>
                <input className="input w-40" placeholder="0,00" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
              </div>
              <button onClick={closeDay} disabled={busy} className="btn btn-primary">Fechar caixa</button>
            </div>
          </div>
        ) : (
          <form onSubmit={openDay} className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs text-gray-500">SEM CAIXA ABERTO</div>
              <div className="text-lg font-semibold">Abrir caixa do dia</div>
            </div>
            <div>
              <label className="label">Troco inicial</label>
              <input className="input w-40" placeholder="0,00" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            </div>
            <button disabled={busy} className="btn btn-primary">Abrir caixa</button>
          </form>
        )}
        {err && <div className="text-red-400 text-sm mt-2">{err}</div>}
      </section>

      {day && summary && <CashierSummaryCard summary={summary} />}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Mesas abertas ({sessions.length})</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sessions.length === 0 && (
          <div className="col-span-full text-gray-500 text-center py-16 card p-8">
            Nenhuma mesa aberta
          </div>
        )}
        {sessions.map((s) => {
          const badge = s.status === 'ready_to_close' ? 'bg-green-600/30 text-green-300'
            : s.status === 'delivered' ? 'bg-blue-600/30 text-blue-300'
            : 'bg-yellow-600/30 text-yellow-300';
          const label = s.status === 'ready_to_close' ? 'Paga' : s.status === 'delivered' ? 'Entregue' : 'Em atendimento';
          return (
            <div key={s.id} className={`card p-4 cursor-pointer hover:border-brand-500/50 ${s.status === 'ready_to_close' ? 'border-green-500/50' : ''}`} onClick={() => setModal(s.id)}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xs text-gray-500">MESA</div>
                  <div className="text-4xl font-black">{s.table?.number}</div>
                  {s.table?.label && <div className="text-xs text-gray-400">{s.table.label}</div>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${badge}`}>{label}</span>
              </div>
              <div className="text-sm text-gray-300 mb-1">{s.customerName || 'Cliente'}</div>
              <div className="text-xs text-gray-500 mb-3">{s.orderCount} pedido(s) • {new Date(s.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="border-t border-gray-800 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Total</span><b>{formatBRL(s.subtotal)}</b></div>
                <div className="flex justify-between text-green-400"><span>Pago</span><span>{formatBRL(s.paid)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Restante</span><b className={s.remaining > 0 ? 'text-amber-400' : 'text-green-400'}>{formatBRL(s.remaining)}</b></div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && <CashierSessionModal sessionId={modal} onClose={() => { setModal(null); load(); loadSummary(); }} />}
    </main>
  );
}
