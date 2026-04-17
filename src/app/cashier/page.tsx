'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';

export default function CashierPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/cashier'); return; }
    setStaff(s);
    load();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:dashboard`]);
    const sock = getSocket();
    const r = () => load();
    sock.on('order.created', r);
    sock.on('order.updated', r);
    sock.on('order.status_changed', r);
    sock.on('session.closed', r);
    const id = setInterval(load, 15000);
    return () => { sock.off('order.created', r); sock.off('order.updated', r); sock.off('order.status_changed', r); sock.off('session.closed', r); clearInterval(id); };
  }, []);

  async function load() {
    try { const d = await apiFetch('/api/v1/cashier/sessions'); setSessions(d.sessions); } catch {}
  }

  async function close(id: string, tableNumber: number) {
    if (!confirm(`Fechar conta da mesa ${tableNumber}?`)) return;
    setBusy(id);
    try {
      await apiFetch(`/api/v1/cashier/sessions/${id}/close`, { method: 'POST' });
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sessions.length === 0 && (
          <div className="col-span-full text-gray-500 text-center py-16 card p-8">
            Nenhuma mesa aberta
          </div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className={`card p-4 ${s.status === 'ready_to_close' ? 'border-green-500/50' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-xs text-gray-500">MESA</div>
                <div className="text-4xl font-black">{s.table?.number}</div>
                {s.table?.label && <div className="text-xs text-gray-400">{s.table.label}</div>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'ready_to_close' ? 'bg-green-600/30 text-green-300' : 'bg-yellow-600/30 text-yellow-300'}`}>
                {s.status === 'ready_to_close' ? 'Pronta p/ fechar' : 'Em atendimento'}
              </span>
            </div>
            <div className="text-sm text-gray-300 mb-1">{s.customerName || 'Cliente'}</div>
            <div className="text-xs text-gray-500 mb-3">{s.orderCount} pedido(s) • aberta às {new Date(s.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="border-t border-gray-800 pt-3 flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-2xl font-bold text-brand-500">R$ {Number(s.subtotal).toFixed(2)}</div>
              </div>
              <button onClick={() => close(s.id, s.table?.number)} disabled={busy === s.id} className="btn btn-primary">
                {busy === s.id ? 'Fechando...' : 'Fechar conta'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
