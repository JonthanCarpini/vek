'use client';
import { useEffect, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';

const TYPE: Record<string, string> = { waiter: '🙋 Garçom', bill: '💳 Conta', help: '❓ Ajuda' };

export default function AdminCalls() {
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    load();
    const s = loadStaff(); if (s?.user.unitId) joinRooms([`unit:${s.user.unitId}:waiters`]);
    const sock = getSocket(); const r = () => load();
    sock.on('call.created', r); sock.on('call.attended', r);
    const i = setInterval(load, 10000);
    return () => { sock.off('call.created', r); sock.off('call.attended', r); clearInterval(i); };
  }, []);

  async function load() {
    try { const d = await apiFetch('/api/v1/waiter/calls'); setCalls(d.calls); } catch {}
  }
  async function attend(id: string) {
    try { await apiFetch(`/api/v1/waiter/calls/${id}/attend`, { method: 'PATCH' }); load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Chamadas pendentes</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {calls.map((c: any) => (
          <div key={c.id} className="card p-4">
            <div className="flex justify-between mb-2">
              <div className="text-lg font-bold">Mesa {c.table?.number}</div>
              <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</span>
            </div>
            <div className="text-sm text-gray-300 mb-1">{c.session?.customerName}</div>
            <div className="text-xl mb-3">{TYPE[c.type]}</div>
            <button onClick={() => attend(c.id)} className="btn btn-primary w-full">Atender</button>
          </div>
        ))}
        {calls.length === 0 && <div className="col-span-full text-gray-500 text-center py-10">Nenhuma chamada pendente</div>}
      </div>
    </div>
  );
}
