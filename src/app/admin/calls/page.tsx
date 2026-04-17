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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {calls.map((c: any) => (
          <div key={c.id} className="card p-5 flex flex-col justify-between border-brand-500/10 hover:border-brand-500/30 transition-colors group">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="bg-brand-600/10 p-2 rounded-xl text-brand-500 group-hover:scale-110 transition-transform">
                  <div className="text-sm font-black">MESA</div>
                  <div className="text-2xl font-black">{c.table?.number}</div>
                </div>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full font-medium">{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</span>
              </div>
              <div className="text-sm font-semibold text-gray-200 mb-1 truncate">{c.session?.customerName || 'Cliente'}</div>
              <div className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="opacity-80">{TYPE[c.type].split(' ')[0]}</span>
                <span>{TYPE[c.type].split(' ').slice(1).join(' ')}</span>
              </div>
            </div>
            <button onClick={() => attend(c.id)} className="btn btn-primary w-full py-3 rounded-xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all font-bold tracking-tight">Atender Chamada</button>
          </div>
        ))}
        {calls.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 card bg-white/5 border-dashed border-gray-800">
            <div className="text-5xl mb-4 opacity-20">🙋</div>
            <div className="text-gray-500 font-medium text-lg text-center">Nenhuma chamada pendente no momento</div>
            <p className="text-gray-600 text-sm mt-1">O sistema atualizará automaticamente assim que houver novos chamados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
