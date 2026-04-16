'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { loadStaff } from '@/lib/staff-client';

export default function AdminDashboard() {
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    load();
    const s = loadStaff();
    if (s?.user.unitId) joinRooms([`unit:${s.user.unitId}:dashboard`]);
    const sock = getSocket();
    const r = () => load();
    sock.on('order.created', r); sock.on('order.updated', r); sock.on('session.closed', r);
    const i = setInterval(load, 10000);
    return () => { sock.off('order.created', r); sock.off('order.updated', r); sock.off('session.closed', r); clearInterval(i); };
  }, []);

  async function load() {
    try { const d = await apiFetch('/api/v1/admin/dashboard'); setM(d.dashboard); } catch {}
  }

  const cards = [
    { label: 'Pedidos hoje', value: m?.ordersToday ?? '—', icon: '🧾' },
    { label: 'Receita hoje', value: m ? `R$ ${m.revenueToday.toFixed(2)}` : '—', icon: '💰' },
    { label: 'Ticket médio', value: m ? `R$ ${m.avgTicket.toFixed(2)}` : '—', icon: '📊' },
    { label: 'Mesas ocupadas', value: m?.openTables ?? '—', icon: '🪑' },
    { label: 'Pedidos ativos', value: m?.activeOrders ?? '—', icon: '⏱️' },
    { label: 'Chamadas pendentes', value: m?.pendingCalls ?? '—', icon: '🙋' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className="text-sm text-gray-400">{c.label}</div>
            <div className="text-3xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
