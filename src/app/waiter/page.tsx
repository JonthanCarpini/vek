'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff, clearStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';

const TYPE_LABEL: Record<string, string> = { waiter: '🙋 Garçom', bill: '💳 Conta', help: '❓ Ajuda' };

export default function WaiterPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/waiter'); return; }
    load();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:waiters`]);
    const sock = getSocket();
    const reload = () => load();
    sock.on('call.created', reload);
    sock.on('call.attended', reload);
    const i = setInterval(load, 10000);
    return () => { sock.off('call.created', reload); sock.off('call.attended', reload); clearInterval(i); };
  }, []);

  async function load() {
    try { const d = await apiFetch('/api/v1/waiter/calls'); setCalls(d.calls); } catch {}
  }
  async function attend(id: string) {
    try { await apiFetch(`/api/v1/waiter/calls/${id}/attend`, { method: 'PATCH' }); load(); } catch (e: any) { alert(e.message); }
  }
  function elapsed(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 1 ? 'agora' : `${m}min`;
  }

  return (
    <main className="min-h-screen p-4">
      <header className="flex justify-between items-center mb-4">
        <div className="text-2xl font-bold">🙋 Painel do Garçom</div>
        <button onClick={() => { clearStaff(); router.push('/admin/login'); }} className="btn btn-ghost">Sair</button>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {calls.map((c: any) => (
          <div key={c.id} className="card p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-lg font-bold">Mesa {c.table?.number}</div>
              <span className="text-xs text-gray-400">{elapsed(c.createdAt)}</span>
            </div>
            <div className="text-sm text-gray-300 mb-1">{c.session?.customerName}</div>
            <div className="text-xl mb-3">{TYPE_LABEL[c.type]}</div>
            <button onClick={() => attend(c.id)} className="btn btn-primary w-full">Atender</button>
          </div>
        ))}
        {calls.length === 0 && <div className="col-span-full text-center text-gray-500 py-16">Nenhum chamado no momento</div>}
      </div>
    </main>
  );
}
