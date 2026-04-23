'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, RefreshCw, Package } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { formatBRL } from '../_lib/api';
import { SkeletonList } from '../_components/Skeleton';

type Filter = 'all' | 'active' | 'done';

const ACTIVE_STATUSES = new Set(['received', 'accepted', 'preparing', 'ready', 'dispatched']);

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  received: { label: 'Recebido', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-700' },
  preparing: { label: 'Em preparo', color: 'bg-yellow-100 text-yellow-700' },
  ready: { label: 'Pronto', color: 'bg-green-100 text-green-700' },
  dispatched: { label: 'Saiu p/ entrega', color: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Entregue', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export default function PedidosPage() {
  const router = useRouter();
  const { customer, orders, loadingOrders, reloadOrders } = useDelivery();
  const [filter, setFilter] = useState<Filter>('all');

  // Pull-to-refresh state
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!customer) {
      router.replace('/delivery/perfil');
    }
  }, [customer, router]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0 && window.scrollY === 0) {
      setPullDist(Math.min(dist, 80));
    }
  };
  const handleTouchEnd = async () => {
    if (pullDist > 60 && !refreshing) {
      setRefreshing(true);
      await reloadOrders();
      setRefreshing(false);
    }
    setPullDist(0);
    touchStartY.current = null;
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'active') return orders.filter((o) => ACTIVE_STATUSES.has(o.status));
    return orders.filter((o) => !ACTIVE_STATUSES.has(o.status));
  }, [orders, filter]);

  if (!customer) {
    return null; // redirect em andamento
  }

  return (
    <div
      className="min-h-screen bg-gray-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">Meus pedidos</h1>
          <button
            onClick={() => reloadOrders()}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${loadingOrders || refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filtros */}
        <div className="max-w-md mx-auto px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              { v: 'all' as Filter, label: 'Todos' },
              { v: 'active' as Filter, label: 'Em andamento' },
              { v: 'done' as Filter, label: 'Concluídos' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                  filter === f.v
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Pull-to-refresh indicator */}
      {(pullDist > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: refreshing ? 48 : pullDist }}
        >
          <RefreshCw className={`w-5 h-5 text-orange-500 ${refreshing || pullDist > 60 ? 'animate-spin' : ''}`} />
        </div>
      )}

      {/* Lista */}
      <main className="max-w-md mx-auto px-4 py-4">
        {loadingOrders && orders.length === 0 ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {filter === 'active' ? 'Nenhum pedido em andamento' :
               filter === 'done' ? 'Nenhum pedido concluído' :
               'Você ainda não fez nenhum pedido'}
            </p>
            {orders.length === 0 && (
              <Link
                href="/delivery"
                className="inline-block mt-4 text-orange-500 text-sm font-semibold"
              >
                Ver cardápio →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
  const status = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' };
  const isTakeout = order.orderType === 'takeout';
  return (
    <Link
      href={`/delivery/pedidos/${order.id}`}
      className="block bg-white rounded-xl p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">#{order.sequenceNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className="text-xs text-gray-500">
              {isTakeout ? '🛍️ Retirada' : '🛵 Entrega'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(order.createdAt).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          <div className="text-sm text-gray-600 mt-1 truncate">
            {order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-orange-600">{formatBRL(order.total)}</div>
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
        </div>
      </div>
    </Link>
  );
}
