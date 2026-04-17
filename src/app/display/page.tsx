'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  received: 'Recebido',
  accepted: 'Aceito',
  preparing: 'Preparando',
  ready: 'Pronto',
};
const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-600',
  accepted: 'bg-blue-600',
  preparing: 'bg-yellow-600',
  ready: 'bg-green-600',
};

export default function DisplayPage() {
  const [data, setData] = useState<any>({ unit: null, orders: [], featured: [] });
  const [idx, setIdx] = useState(0);

  async function load() {
    try {
      const r = await fetch('/api/v1/public/display', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setData(j.data);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!data.unit?.id) return;
    const sock = getSocket();
    sock.emit('join', `unit:${data.unit.id}:dashboard`);
    const r = () => load();
    sock.on('order.created', r);
    sock.on('order.status_changed', r);
    return () => { sock.off('order.created', r); sock.off('order.status_changed', r); };
  }, [data.unit?.id]);

  useEffect(() => {
    if (!data.featured?.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % data.featured.length), 6000);
    return () => clearInterval(t);
  }, [data.featured?.length]);

  const primary = data.unit?.primaryColor || '#ea580c';
  const ready = data.orders.filter((o: any) => o.status === 'ready');
  const inProgress = data.orders.filter((o: any) => o.status !== 'ready');
  const featured = data.featured?.[idx];

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white overflow-hidden">
      <header className="flex items-center justify-between px-10 py-6 border-b border-gray-800">
        <div className="flex items-center gap-4">
          {data.unit?.logoUrl && <img src={data.unit.logoUrl} alt="logo" className="w-16 h-16 rounded-full object-cover" />}
          <div>
            <h1 className="text-4xl font-bold" style={{ color: primary }}>{data.unit?.name || 'Mesa Digital'}</h1>
            <p className="text-gray-400 text-sm">{data.unit?.address}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">AGORA</div>
          <Clock />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6 p-8 h-[calc(100vh-120px)]">
        {/* Featured */}
        <div className="col-span-1 flex flex-col">
          <h2 className="text-2xl font-bold mb-4" style={{ color: primary }}>🔥 Destaques</h2>
          {featured ? (
            <div className="card flex-1 flex flex-col overflow-hidden">
              {featured.imageUrl ? (
                <img src={featured.imageUrl} alt={featured.name} className="w-full h-96 object-cover" />
              ) : (
                <div className="w-full h-96 bg-gray-800 flex items-center justify-center text-6xl">🍔</div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-xs uppercase tracking-widest text-gray-500">{featured.category?.name}</div>
                <div className="text-3xl font-bold mt-1">{featured.name}</div>
                <div className="text-gray-300 mt-2 flex-1">{featured.description}</div>
                <div className="text-4xl font-extrabold mt-4" style={{ color: primary }}>{formatBRL(featured.price)}</div>
              </div>
            </div>
          ) : (
            <div className="card flex-1 flex items-center justify-center text-gray-500">Nenhum destaque</div>
          )}
          <div className="flex gap-1 mt-3 justify-center">
            {data.featured?.map((_: any, i: number) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === idx ? 'bg-white' : 'bg-gray-600'}`} />
            ))}
          </div>
        </div>

        {/* Ready orders */}
        <div className="col-span-1 flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-green-400">✅ Prontos para retirada</h2>
          <div className="grid grid-cols-2 gap-3 content-start overflow-hidden">
            {ready.length === 0 && <div className="col-span-2 text-gray-500 py-16 text-center">Nenhum pedido pronto</div>}
            {ready.slice(0, 10).map((o: any) => (
              <div key={o.id} className="card p-5 text-center bg-green-600/20 border-green-600/40 animate-pulse">
                <div className="text-xs text-gray-300 uppercase">Mesa</div>
                <div className="text-5xl font-black">{o.table?.number}</div>
                <div className="text-xs text-green-300 mt-1">#{o.sequenceNumber}</div>
              </div>
            ))}
          </div>
        </div>

        {/* In progress */}
        <div className="col-span-1 flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">⏳ Em preparo</h2>
          <div className="flex-1 overflow-hidden space-y-2">
            {inProgress.length === 0 && <div className="text-gray-500 py-16 text-center">Nenhum pedido em andamento</div>}
            {inProgress.slice(0, 12).map((o: any) => (
              <div key={o.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold w-14 text-center">{o.table?.number}</div>
                  <div className="text-xs text-gray-400">#{o.sequenceNumber}</div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full text-white ${STATUS_COLORS[o.status] || 'bg-gray-700'}`}>
                  {STATUS_LABELS[o.status] || o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Clock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);
  return <div className="text-5xl font-bold font-mono">{t}</div>;
}
