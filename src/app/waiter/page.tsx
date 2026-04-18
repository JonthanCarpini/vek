'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff, clearStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';
import { WaiterTableModal } from '@/components/WaiterTableModal';
import { PwaHead } from '@/components/PwaHead';
import { playNotificationSound } from '@/lib/notifications';
import { Download } from 'lucide-react';

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
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 4000); }

  useEffect(() => {
    // PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/waiter'); return; }
    loadAll();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:waiters`]);
    const sock = getSocket();
    
    // Notificações sonoras
    const onCall = (p: any) => { 
      loadAll(); 
      playNotificationSound('call'); 
      showToast(`Chamado na mesa ${p?.table?.number || ''}`);
    };
    const onOrder = (p: any) => { 
      loadAll(); 
      playNotificationSound('order'); 
      showToast(`Novo pedido #${p?.sequenceNumber || ''}`);
    };
    const reload = () => loadAll();

    sock.on('call.created', onCall);
    sock.on('call.attended', reload);
    sock.on('order.created', onOrder);
    sock.on('order.updated', onOrder);
    sock.on('order.status_changed', reload);
    sock.on('session.closed', reload);

    const i = setInterval(loadAll, 10000);
    return () => {
      sock.off('call.created', onCall); 
      sock.off('call.attended', reload);
      sock.off('order.created', onOrder); 
      sock.off('order.updated', onOrder);
      sock.off('order.status_changed', reload); 
      sock.off('session.closed', reload);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(i);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }

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
    <div className="min-h-screen flex flex-col bg-[color:var(--bg)]">
      <PwaHead manifest="/manifest-waiter.json" />

      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[color:var(--card)] border-b border-[color:var(--border)] flex items-center justify-between px-4 min-h-[56px]">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛎️</span>
          <span className="font-bold text-base">Painel Garçom</span>
          {pendingCalls > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCalls}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {installPrompt && (
            <button onClick={handleInstall} className="btn btn-primary text-xs px-3 py-2 flex items-center gap-1.5 min-h-0 h-9">
              <Download size={14} /> Instalar
            </button>
          )}
          <button onClick={() => { clearStaff(); router.push('/admin/login'); }} className="btn btn-ghost text-xs px-3 py-2 min-h-0 h-9">Sair</button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-28 overflow-y-auto">
        {tab === 'calls' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {calls.map((c: any) => (
              <div key={c.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Mesa</div>
                    <div className="text-3xl font-black leading-none">{c.table?.number}</div>
                  </div>
                  <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-lg">{elapsed(c.createdAt)}</span>
                </div>
                <div className="text-sm text-gray-300 mb-1 font-medium">{c.session?.customerName}</div>
                <div className="flex flex-col gap-2 mb-4">
                  <div className="text-lg font-semibold">{TYPE_LABEL[c.type]}</div>
                  {c.reason && (
                    <div className="text-sm bg-amber-500/10 text-amber-200 p-3 rounded-xl border border-amber-500/20 italic">
                      "{c.reason}"
                    </div>
                  )}
                  {c.type === 'bill' && c.paymentHint && (
                    <div className="text-sm bg-blue-500/10 text-blue-200 p-3 rounded-xl border border-blue-500/20">
                      💳 Pagamento: <b>{c.paymentHint}</b>
                      {c.splitCount && ` (Dividir em ${c.splitCount})`}
                    </div>
                  )}
                </div>
                <button onClick={() => attend(c.id)} className="btn btn-primary w-full">Atender</button>
              </div>
            ))}
            {calls.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-20">
                <div className="text-4xl mb-3">✅</div>
                <div>Nenhum chamado no momento</div>
              </div>
            )}
          </div>
        )}

        {tab === 'tables' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sessions.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-20">
                <div className="text-4xl mb-3">🍽️</div>
                <div>Nenhuma mesa ocupada</div>
              </div>
            )}
            {sessions.map((s: any) => (
              <div key={s.id} className={`card p-4 ${s.readyOrders > 0 ? 'border-green-500/50 shadow-green-900/20 shadow-lg' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Mesa</div>
                    <div className="text-4xl font-black leading-none">{s.table?.number}</div>
                    {s.table?.label && <div className="text-xs text-gray-400 mt-0.5">{s.table.label}</div>}
                  </div>
                  <div className="text-right flex flex-col gap-1">
                    {s.readyOrders > 0 && (
                      <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {s.readyOrders} pronto(s) 🔔
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{elapsed(s.openedAt)}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-300 mb-1">{s.customerName}</div>
                <div className="text-xs text-gray-500 mb-4">{s.orderCount} pedido(s) · {formatBRL(s.subtotal)}</div>

                {s.orders?.filter((o: any) => o.status === 'ready').length > 0 && (
                  <div className="space-y-2 mb-3">
                    {s.orders.filter((o: any) => o.status === 'ready').map((o: any) => (
                      <button key={o.id} onClick={() => deliver(o.id)} className="btn btn-primary w-full text-sm">
                        🔔 Entregar #{o.sequenceNumber} — {formatBRL(Number(o.total))}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setManageSession(s.id)}
                  className="btn btn-ghost w-full text-sm border border-brand-500/30 text-brand-300"
                >
                  ⚙️ Gerenciar mesa
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[color:var(--card)] border-t border-[color:var(--border)] flex z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          onClick={() => setTab('tables')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 touch-manipulation min-h-[60px] transition-colors ${tab === 'tables' ? 'text-brand-400' : 'text-gray-500'}`}
        >
          <span className="text-2xl leading-none">🍽️</span>
          <span className="text-[11px] font-semibold">
            Mesas {sessions.length > 0 && `(${sessions.length})`}
            {totalReady > 0 && <span className="ml-1 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full align-middle">{totalReady}</span>}
          </span>
        </button>
        <button
          onClick={() => setTab('calls')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 touch-manipulation min-h-[60px] transition-colors relative ${tab === 'calls' ? 'text-brand-400' : 'text-gray-500'}`}
        >
          <span className="text-2xl leading-none">🙋</span>
          <span className="text-[11px] font-semibold">
            Chamados
            {pendingCalls > 0 && <span className="ml-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full align-middle">{pendingCalls}</span>}
          </span>
        </button>
      </nav>

      {manageSession && (
        <WaiterTableModal
          sessionId={manageSession}
          onClose={() => { setManageSession(null); loadAll(); }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-brand-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 whitespace-nowrap">
          <span className="text-xl">🔔</span> {toast}
        </div>
      )}
    </div>
  );
}
