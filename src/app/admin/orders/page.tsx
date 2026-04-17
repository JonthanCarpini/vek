'use client';
import { useEffect, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';

const STATUS_FILTERS = ['all', 'received', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'];
const STATUS_LABEL: Record<string, string> = {
  all: 'Todos', received: 'Recebido', accepted: 'Aceito', preparing: 'Em preparo',
  ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
};
const NEXT_STATUS: Record<string, { to: string; label: string } | null> = {
  received: { to: 'accepted', label: 'Aceitar' },
  accepted: { to: 'preparing', label: 'Iniciar preparo' },
  preparing: { to: 'ready', label: 'Marcar pronto' },
  ready: { to: 'delivered', label: 'Entregar' },
  delivered: null,
  cancelled: null,
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    const s = loadStaff(); if (s?.user.unitId) joinRooms([`unit:${s.user.unitId}:dashboard`]);
    const sock = getSocket(); const r = () => load();
    sock.on('order.created', r); sock.on('order.updated', r);
    return () => { sock.off('order.created', r); sock.off('order.updated', r); };
  }, []);

  async function load() {
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`;
      const d = await apiFetch(`/api/v1/admin/orders${q}`);
      setOrders(d.orders);
    } catch {}
  }

  async function advance(id: string, to: string) {
    try {
      await apiFetch(`/api/v1/kitchen/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: to }) });
      load();
    } catch (e: any) { alert(e.message); }
  }
  async function cancel(id: string) {
    if (!confirm('Cancelar este pedido?')) return;
    try {
      await apiFetch(`/api/v1/kitchen/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
      load();
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm ${filter === s ? 'bg-brand-600 text-white' : 'bg-[#1f1f2b]'}`}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1f1f2b] text-left">
            <tr>
              <th className="p-3">#</th><th className="p-3">Mesa</th><th className="p-3">Cliente</th>
              <th className="p-3">Itens</th><th className="p-3">Total</th>
              <th className="p-3">Status</th><th className="p-3">Hora</th><th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} className="border-t border-[color:var(--border)]">
                <td className="p-3 font-bold">#{o.sequenceNumber}</td>
                <td className="p-3">{o.table?.number}</td>
                <td className="p-3">{o.session?.customerName}</td>
                <td className="p-3">{o.items.length}</td>
                <td className="p-3 font-semibold">R$ {Number(o.total).toFixed(2)}</td>
                <td className="p-3"><span className="badge">{STATUS_LABEL[o.status]}</span></td>
                <td className="p-3 text-gray-400">{new Date(o.createdAt).toLocaleTimeString('pt-BR')}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {NEXT_STATUS[o.status] && (
                      <button onClick={() => advance(o.id, NEXT_STATUS[o.status]!.to)} className="btn btn-primary text-xs px-2 py-1">
                        {NEXT_STATUS[o.status]!.label}
                      </button>
                    )}
                    {o.status !== 'cancelled' && o.status !== 'delivered' && (
                      <button onClick={() => cancel(o.id)} className="btn btn-ghost text-xs px-2 py-1 text-red-400">Cancelar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-500">Nenhum pedido</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
