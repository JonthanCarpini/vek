'use client';

import { useEffect, useState } from 'react';
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
      const res = await fetch('/api/v1/admin/delivery/orders?status=all', { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        setCounts(body.data?.counts || {});
      }
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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🚴 Delivery</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie pedidos, configurações e taxa de entrega
        </p>
      </header>

      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'orders'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'config'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
