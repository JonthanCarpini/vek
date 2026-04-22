'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  received: { label: 'Recebido', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-700' },
  preparing: { label: 'Em preparo', color: 'bg-yellow-100 text-yellow-700' },
  ready: { label: 'Pronto', color: 'bg-green-100 text-green-700' },
  dispatched: { label: 'Saiu p/ entrega', color: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Entregue', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

const NEXT_STATUS: Record<string, string | null> = {
  received: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'dispatched',
  dispatched: 'delivered',
};

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/admin/delivery/orders?status=${filter}`);
      setOrders(data.orders || []);
    } catch {} finally { setLoading(false); }
  };

  const loadDrivers = async () => {
    try {
      const data = await apiFetch('/api/v1/admin/drivers?active=true');
      setDrivers(data?.drivers || []);
    } catch {}
  };

  useEffect(() => {
    loadOrders();
    loadDrivers();
    const t = setInterval(loadOrders, 15_000);
    return () => clearInterval(t);
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const body: any = { status };
      if (status === 'cancelled') {
        const reason = prompt('Motivo do cancelamento?');
        if (reason === null) return;
        body.reason = reason;
      }
      await apiFetch(`/api/v1/admin/delivery/orders/${id}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      alert(e.message || 'Falha ao atualizar');
    }
    loadOrders();
  };

  const assignDriver = async (id: string, driverId: string | null) => {
    try {
      await apiFetch(`/api/v1/admin/delivery/orders/${id}/assign-driver`, {
        method: 'POST',
        body: JSON.stringify({ driverId }),
      });
    } catch (e: any) {
      alert(e.message || 'Falha ao atribuir motoboy');
    }
    loadOrders();
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            filter === 'active' ? 'bg-orange-500 text-white' : 'bg-white border text-gray-700'
          }`}
        >
          Em andamento
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            filter === 'all' ? 'bg-orange-500 text-white' : 'bg-white border text-gray-700'
          }`}
        >
          Todos
        </button>
        <button
          onClick={loadOrders}
          className="ml-auto px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
        >
          🔄 Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-lg border">
          Nenhum pedido {filter === 'active' ? 'em andamento' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const status = STATUS_LABELS[o.status] || { label: o.status, color: 'bg-gray-100' };
            const expanded = expandedId === o.id;
            const next = NEXT_STATUS[o.status];
            const isTakeout = o.orderType === 'takeout';

            return (
              <div key={o.id} className="bg-white rounded-lg border overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg">#{o.sequenceNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {isTakeout ? '🛍️ Retirada' : '🛵 Entrega'}
                        </span>
                        {o.paymentStatus === 'paid' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            💳 Pago
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{o.customerName} • {o.customerPhone}</div>
                      {!isTakeout && o.deliveryAddress && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{o.deliveryAddress}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">{formatBRL(o.total)}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Itens</h4>
                      <div className="space-y-1 text-sm">
                        {o.items.map((i: any) => (
                          <div key={i.id} className="flex justify-between">
                            <span>{i.quantity}x {i.name}</span>
                            <span>{formatBRL(i.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-sm mt-2 pt-2 border-t">
                        <span className="text-gray-600">Subtotal</span>
                        <span>{formatBRL(o.subtotal)}</span>
                      </div>
                      {o.deliveryFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Taxa entrega ({o.distanceKm}km)</span>
                          <span>{formatBRL(o.deliveryFee)}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase">Pagamento</h4>
                        <div>{o.paymentMethod} {o.changeFor ? `(troco p/ ${formatBRL(o.changeFor)})` : ''}</div>
                      </div>
                      {o.notes && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase">Observações</h4>
                          <div>{o.notes}</div>
                        </div>
                      )}
                    </div>

                    {!isTakeout && ['accepted', 'preparing', 'ready', 'dispatched'].includes(o.status) && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Motoboy</h4>
                        <select
                          value={o.driver?.id || ''}
                          onChange={(e) => assignDriver(o.id, e.target.value || null)}
                          className="w-full sm:w-auto px-3 py-1.5 text-sm border rounded-lg"
                        >
                          <option value="">— Não atribuído —</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap pt-2 border-t">
                      {next && o.status !== 'cancelled' && (
                        <button
                          onClick={() => updateStatus(o.id, next)}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-sm rounded-lg font-medium"
                        >
                          → {STATUS_LABELS[next].label}
                        </button>
                      )}
                      {o.status !== 'cancelled' && o.status !== 'delivered' && (
                        <button
                          onClick={() => updateStatus(o.id, 'cancelled')}
                          className="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 text-sm rounded-lg"
                        >
                          Cancelar
                        </button>
                      )}
                      <a
                        href={`/t/${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white border text-gray-600 hover:bg-gray-50 px-3 py-1.5 text-sm rounded-lg"
                      >
                        🔗 Tracking
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
