'use client';
import { useEffect, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';

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
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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
                <td className="p-3 font-semibold">{formatBRL(o.total)}</td>
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
                    <button onClick={() => setSelectedOrder(o)} className="btn btn-ghost text-xs px-2 py-1 text-brand-400 border border-brand-500/20">Ver Itens</button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-500">Nenhum pedido</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f1f2b]">
              <div>
                <h3 className="text-lg font-bold">Detalhes do Pedido #{selectedOrder.sequenceNumber}</h3>
                <div className="text-xs text-gray-400">Mesa {selectedOrder.table?.number} • {selectedOrder.session?.customerName}</div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-800">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Qtd</th>
                    <th className="py-2 text-right">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {selectedOrder.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-3">
                        <div className="font-medium">{it.name}</div>
                        {it.notes && <div className="text-xs text-brand-400 italic">"{it.notes}"</div>}
                      </td>
                      <td className="py-3 text-center">{it.quantity}</td>
                      <td className="py-3 text-right">{formatBRL(Number(it.unitPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {selectedOrder.notes && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-200">
                  <div className="font-bold mb-1">Observações do Pedido:</div>
                  {selectedOrder.notes}
                </div>
              )}
            </div>
            <div className="p-4 bg-[#1f1f2b] border-t border-gray-800 flex justify-between items-center">
              <div className="text-sm text-gray-400">Total</div>
              <div className="text-xl font-black text-brand-500">{formatBRL(selectedOrder.total)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
