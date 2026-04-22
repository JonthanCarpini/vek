'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadStaff, clearStaff } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { PwaHead } from '@/components/PwaHead';
import { Download } from 'lucide-react';

// 3 status visíveis no KDS. 'received' e 'accepted' aparecem em "Aguardando".
// Ao iniciar preparo, o pedido vai direto para 'preparing'.
const COLS = [
  { key: 'waiting', label: 'Aguardando', match: ['received', 'accepted'], next: 'preparing', nextLabel: 'Iniciar preparo' },
  { key: 'preparing', label: 'Em preparo', match: ['preparing'], next: 'ready', nextLabel: 'Marcar pronto' },
  { key: 'ready', label: 'Prontos', match: ['ready'], next: 'delivered', nextLabel: 'Entregue' },
] as const;

export default function KDSPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [staff, setStaff] = useState<any>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    // PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const s = loadStaff();
    if (!s) { router.push('/admin/login?next=/kds'); return; }
    setStaff(s);
    load();
    if (s.user.unitId) joinRooms([`unit:${s.user.unitId}:kitchen`]);
    const sock = getSocket();
    const reload = () => load();
    sock.on('order.created', reload);
    sock.on('order.updated', reload);
    sock.on('order.status_changed', reload);
    const i = setInterval(load, 15000);
    return () => { 
      sock.off('order.created', reload); 
      sock.off('order.updated', reload); 
      sock.off('order.status_changed', reload); 
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

  async function load() {
    try { const d = await apiFetch('/api/v1/kitchen/orders'); setOrders(d.orders); } catch {}
  }
  async function advance(id: string, next: string) {
    try {
      await apiFetch(`/api/v1/kitchen/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      load();
    } catch (e: any) { alert(e.message); }
  }

  function elapsed(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return `${m}min`;
  }

  function OrderCard({ order, late, elapsed, onAdvance, nextLabel }:
    { order: any; late: boolean; elapsed: string; onAdvance: () => void; nextLabel: string }) {
    const [open, setOpen] = useState(false);
    return (
      <div className={`card p-3 ${late ? 'border-red-500' : ''} ${order.channel === 'ifood' ? 'border-l-4 border-l-red-500' : ''}`}>
        <div className="flex justify-between text-sm">
          <span className="font-bold flex items-center gap-2">
            #{order.sequenceNumber}
            {order.channel === 'ifood' ? (
              <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">🛵 iFood</span>
            ) : (
              <span>• Mesa {order.table?.number}</span>
            )}
          </span>
          <span className={late ? 'text-red-400' : 'text-gray-400'}>{elapsed}</span>
        </div>
        <div className="text-xs text-gray-400 mb-2">
          {order.channel === 'ifood' ? (order.customerName || 'iFood') : order.session?.customerName}
          {order.channel === 'ifood' && order.ifoodDisplayId && (
            <span className="ml-2 text-red-400">· {order.ifoodDisplayId}</span>
          )}
        </div>
        <ul className="text-sm mb-2 space-y-1">
          {order.items.map((i: any) => (
            <li key={i.id} className="border-l-2 border-brand-600/40 pl-2">
              <div className="flex justify-between">
                <span className="font-medium">{i.quantity}× {i.name}</span>
              </div>
              {i.notes && <div className="text-xs text-yellow-400">Obs: {i.notes}</div>}
              {open && (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  {i.product?.description && <div>📝 {i.product.description}</div>}
                  {i.product?.station && <div>🏷️ Estação: {i.product.station}</div>}
                  {i.product?.preparationTimeMin != null && <div>⏱️ Preparo est.: {i.product.preparationTimeMin} min</div>}
                  {Array.isArray(i.product?.ingredients) && i.product.ingredients.length > 0 && (
                    <div>🧂 Ingredientes: {i.product.ingredients.map((ing: any) => ing.name).join(', ')}</div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="text-xs text-gray-400 hover:text-white mb-2 block">
          {open ? '▲ Ocultar detalhes' : '▼ Ver detalhes dos itens'}
        </button>
        <button onClick={onAdvance} className="btn btn-primary w-full text-sm">{nextLabel}</button>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <PwaHead manifest="/manifest-kitchen.json" />
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold">🍳 KDS — Cozinha</div>
            <div className="text-sm text-gray-400">{staff?.user?.name}</div>
          </div>
          {installPrompt && (
            <button 
              onClick={handleInstall}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <Download size={16} /> Instalar App
            </button>
          )}
        </div>
        <button onClick={() => { clearStaff(); router.push('/admin/login'); }} className="btn btn-ghost">Sair</button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLS.map((col) => {
          const list = orders.filter((o: any) => (col.match as readonly string[]).includes(o.status));
          return (
            <div key={col.key} className="card p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">{col.label}</div>
                <span className="badge">{list.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {list.map((o: any) => {
                  const late = (Date.now() - new Date(o.createdAt).getTime()) > 15 * 60000;
                  return (
                    <OrderCard key={o.id} order={o} late={late} elapsed={elapsed(o.createdAt)}
                      onAdvance={() => advance(o.id, col.next)} nextLabel={col.nextLabel} />
                  );
                })}
                {list.length === 0 && <div className="text-sm text-gray-500 text-center py-6">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
