'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff, clearStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';
import { WaiterTableModal } from '@/components/WaiterTableModal';

const TYPE_LABEL: Record<string, string> = { waiter: '🙋 Garçom', bill: '💳 Conta', help: '❓ Ajuda' };
const STATUS_LABEL: Record<string, string> = {
  received: 'Recebido', accepted: 'Aceito', preparing: 'Preparando', ready: 'Pronto', delivered: 'Entregue',
};
const STATUS_COLOR: Record<string, string> = {
  received: 'bg-gray-700',
  accepted: 'bg-blue-700',
  preparing: 'bg-yellow-700',
  ready: 'bg-green-700',
  delivered: 'bg-gray-800',
};

type Tab = 'tables' | 'calls';

export default function WaiterPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tables');
  const [calls, setCalls] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [manageSession, setManageSession] = useState<string | null>(null);

  useEffect(() => {
    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/waiter'); return; }
    loadAll();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:waiters`]);
    const sock = getSocket();
    const reload = () => loadAll();
    sock.on('call.created', reload);
    sock.on('call.attended', reload);
    sock.on('order.created', reload);
    sock.on('order.updated', reload);
    sock.on('order.status_changed', reload);
    sock.on('session.closed', reload);
    const i = setInterval(loadAll, 10000);
    return () => {
      sock.off('call.created', reload); sock.off('call.attended', reload);
      sock.off('order.created', reload); sock.off('order.updated', reload);
      sock.off('order.status_changed', reload); sock.off('session.closed', reload);
      clearInterval(i);
    };
  }, []);

  async function loadAll() { await Promise.all([loadCalls(), loadSessions()]); }
  async function loadCalls() {
    try { const d = await apiFetch('/api/v1/waiter/calls'); setCalls(d.calls); } catch {}
  }
  async function loadSessions() {
    try { const d = await apiFetch('/api/v1/waiter/tables'); setSessions(d.sessions); } catch {}
  }
  async function attend(id: string) {
    try { await apiFetch(`/api/v1/waiter/calls/${id}/attend`, { method: 'PATCH' }); loadCalls(); }
    catch (e: any) { alert(e.message); }
  }
  async function deliver(orderId: string) {
    try { await apiFetch(`/api/v1/waiter/orders/${orderId}/deliver`, { method: 'POST' }); loadSessions(); }
    catch (e: any) { alert(e.message); }
  }
  function elapsed(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 1 ? 'agora' : `${m}min`;
  }

  const pendingCalls = calls.length;
  const totalReady = sessions.reduce((a, s) => a + (s.readyOrders || 0), 0);

  return (
    <main className="min-h-screen p-4">
      <header className="flex justify-between items-center mb-4">
        <div className="text-2xl font-bold">🙋 Painel do Garçom</div>
        <button onClick={() => { clearStaff(); router.push('/admin/login'); }} className="btn btn-ghost">Sair</button>
      </header>

      <div className="flex gap-2 mb-4 border-b border-gray-800">
        <button onClick={() => setTab('tables')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === 'tables' ? 'border-brand-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
          Mesas ({sessions.length}){totalReady > 0 && <span className="ml-2 bg-green-600 text-white px-2 py-0.5 rounded-full text-xs">{totalReady} prontos</span>}
        </button>
        <button onClick={() => setTab('calls')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === 'calls' ? 'border-brand-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
          Chamados{pendingCalls > 0 && <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs">{pendingCalls}</span>}
        </button>
      </div>

      {tab === 'calls' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {calls.map((c: any) => (
            <div key={c.id} className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="text-lg font-bold">Mesa {c.table?.number}</div>
                <span className="text-xs text-gray-400">{elapsed(c.createdAt)}</span>
              </div>
              <div className="text-sm text-gray-300 mb-1">{c.session?.customerName}</div>
              <div className="flex flex-col gap-1 mb-3">
                <div className="text-xl font-semibold">{TYPE_LABEL[c.type]}</div>
                {c.reason && (
                  <div className="text-sm bg-amber-500/10 text-amber-200 p-2 rounded-lg border border-amber-500/20 italic">
                    "{c.reason}"
                  </div>
                )}
                {c.type === 'bill' && c.paymentHint && (
                  <div className="text-sm bg-blue-500/10 text-blue-200 p-2 rounded-lg border border-blue-500/20">
                    💳 Pagamento: <b>{c.paymentHint}</b>
                    {c.splitCount && ` (Dividir em ${c.splitCount})`}
                  </div>
                )}
              </div>
              <button onClick={() => attend(c.id)} className="btn btn-primary w-full">Atender</button>
            </div>
          ))}
          {calls.length === 0 && <div className="col-span-full text-center text-gray-500 py-16">Nenhum chamado no momento</div>}
        </div>
      )}

      {tab === 'tables' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sessions.length === 0 && <div className="col-span-full text-center text-gray-500 py-16">Nenhuma mesa ocupada</div>}
          {sessions.map((s: any) => {
            return (
              <div key={s.id} className={`card p-4 ${s.readyOrders > 0 ? 'border-green-500/50' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs text-gray-500">MESA</div>
                    <div className="text-3xl font-black">{s.table?.number}</div>
                    {s.table?.label && <div className="text-xs text-gray-400">{s.table.label}</div>}
                  </div>
                  <div className="text-right">
                    {s.readyOrders > 0 && <span className="bg-green-600/30 text-green-300 px-2 py-1 rounded-full text-xs font-bold">{s.readyOrders} pronto(s)</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-300">{s.customerName}</div>
                <div className="text-xs text-gray-500 mb-3">Aberta {elapsed(s.openedAt)} atrás · {s.orderCount} pedido(s) · {formatBRL(s.subtotal)}</div>

                {/* Atalhos de pedidos prontos para entregar */}
                {s.orders?.filter((o: any) => o.status === 'ready').length > 0 && (
                  <div className="space-y-1 mb-3">
                    {s.orders.filter((o: any) => o.status === 'ready').map((o: any) => (
                      <button key={o.id} onClick={() => deliver(o.id)}
                        className="btn btn-primary w-full text-sm py-1.5">
                        🔔 Entregar #{o.sequenceNumber} ({formatBRL(Number(o.total))})
                      </button>
                    ))}
                  </div>
                )}

                <button onClick={() => setManageSession(s.id)}
                  className="btn btn-ghost w-full text-sm border border-brand-500/30 text-brand-300 hover:bg-brand-500/10">
                  ⚙️ Gerenciar mesa
                </button>
              </div>
            );
          })}
        </div>
      )}

      {manageSession && (
        <WaiterTableModal
          sessionId={manageSession}
          onClose={() => { setManageSession(null); loadAll(); }}
        />
      )}
    </main>
  );
}
