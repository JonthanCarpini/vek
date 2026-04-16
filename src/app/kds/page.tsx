'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';

const COLS = [
  { key: 'received', label: 'Novos', next: 'accepted', nextLabel: 'Aceitar' },
  { key: 'accepted', label: 'Aceitos', next: 'preparing', nextLabel: 'Iniciar preparo' },
  { key: 'preparing', label: 'Em preparo', next: 'ready', nextLabel: 'Marcar pronto' },
  { key: 'ready', label: 'Prontos', next: 'delivered', nextLabel: 'Entregue' },
];

export default function KDSPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [staff, setStaff] = useState<any>(null);

  useEffect(() => {
    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/kds'); return; }
    setStaff(s);
    load();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:kitchen`]);
    const sock = getSocket();
    const reload = () => load();
    sock.on('order.created', reload);
    sock.on('order.updated', reload);
    sock.on('order.status_changed', reload);
    const i = setInterval(load, 15000);
    return () => { sock.off('order.created', reload); sock.off('order.updated', reload); sock.off('order.status_changed', reload); clearInterval(i); };
  }, []);

  async function load() {
    try { const d = await apiFetch('/api/v1/kitchen/orders'); setOrders(d.orders); } catch {}
  }
  async function advance(id: string, next: string) {
    try {
      await apiFetch(`/api/v1/kitchen/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      load();
    } catch (e: any) { alert(e.message); }
  }

  function elapsed(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return `${m}min`;
  }

  return (
    <main className="min-h-screen p-4">
      <header className="flex justify-between items-center mb-4">
        <div>
          <div className="text-2xl font-bold">🍳 KDS — Cozinha</div>
          <div className="text-sm text-gray-400">{staff?.user?.name}</div>
        </div>
        <button onClick={() => { localStorage.removeItem('md:staff'); router.push('/admin/login'); }} className="btn btn-ghost">Sair</button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {COLS.map((col) => {
          const list = orders.filter((o: any) => o.status === col.key);
          return (
            <div key={col.key} className="card p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">{col.label}</div>
                <span className="badge">{list.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {list.map((o: any) => {
                  const late = (Date.now() - new Date(o.createdAt).getTime()) > 15 * 60000;
                  return (
                    <div key={o.id} className={`card p-3 ${late ? 'border-red-500' : ''}`}>
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">#{o.sequenceNumber} • Mesa {o.table?.number}</span>
                        <span className={late ? 'text-red-400' : 'text-gray-400'}>{elapsed(o.createdAt)}</span>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">{o.session?.customerName}</div>
                      <ul className="text-sm mb-3 space-y-1">
                        {o.items.map((i: any) => (
                          <li key={i.id}>• {i.quantity}× {i.name}{i.notes ? <span className="text-yellow-400"> — {i.notes}</span> : null}</li>
                        ))}
                      </ul>
                      {col.next && (
                        <button onClick={() => advance(o.id, col.next!)} className="btn btn-primary w-full text-sm">
                          {col.nextLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
                {list.length === 0 && <div className="text-sm text-gray-500 text-center py-6">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
