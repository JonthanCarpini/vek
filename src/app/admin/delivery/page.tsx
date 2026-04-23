'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Map as MapIcon } from 'lucide-react';
import { apiFetch } from '@/lib/staff-client';
import ConfigTab from './_components/ConfigTab';
import OrdersTab from './_components/OrdersTab';

type Tab = 'config' | 'orders';

export default function AdminDeliveryPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCounts();
    const t = setInterval(loadCounts, 30_000);
    return () => clearInterval(t);
  }, []);

  const loadCounts = async () => {
    try {
      const data = await apiFetch('/api/v1/admin/delivery/orders?status=all');
      setCounts(data?.counts || {});
    } catch {}
  };

  const activeCount =
    (counts.received || 0) +
    (counts.accepted || 0) +
    (counts.preparing || 0) +
    (counts.ready || 0) +
    (counts.dispatched || 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">🚴 Delivery</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie pedidos, configurações e taxa de entrega
          </p>
        </div>
        <Link
          href="/admin/delivery/map"
          className="btn btn-secondary text-sm flex items-center gap-2"
        >
          <MapIcon className="w-4 h-4" /> Mapa ao vivo
          {(counts.dispatched || 0) > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {counts.dispatched}
            </span>
          )}
        </Link>
      </header>

      <div className="flex gap-1 border-b border-gray-800 mb-6">
        <button
          onClick={() => setTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'orders'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Pedidos {activeCount > 0 && (
            <span className="ml-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('config')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'config'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Configuração
        </button>
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'config' && <ConfigTab />}
    </div>
  );
}
