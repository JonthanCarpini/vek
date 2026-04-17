'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';

type Product = { id: string; name: string; description: string | null; price: number; imageUrl: string | null; available: boolean; preparationTimeMin: number; tags: string[]; };
type Category = { id: string; name: string; imageUrl: string | null; products: Product[]; };
type CartItem = { productId: string; name: string; price: number; quantity: number; notes?: string };
type Order = { id: string; sequenceNumber: number; status: string; total: number; createdAt: string; items: any[] };

const STATUS_LABEL: Record<string, string> = {
  received: 'Recebido', accepted: 'Aceito', preparing: 'Em preparo',
  ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
};

export default function ClientPage() {
  const params = useParams<{ token: string }>();
  const qrToken = params.token;
  const [step, setStep] = useState<'intro' | 'checkin' | 'menu' | 'browse'>('intro');
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false); const [err, setErr] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Recupera sessão do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`md:session:${qrToken}`);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setToken(d.token); setSession(d.session); setStep('menu');
      } catch {}
    }
  }, [qrToken]);

  useEffect(() => {
    if (step === 'menu' && token) {
      loadMenu(); loadOrders();
      joinRooms([`session:${session.id}`]);
      const s = getSocket();
      const onStatus = (p: any) => { loadOrders(); showToast(`Pedido #${p.sequenceNumber ?? ''}: ${STATUS_LABEL[p.status] || p.status}`); };
      s.on('order.status_changed', onStatus);
      s.on('order.updated', () => loadOrders());
      return () => { s.off('order.status_changed', onStatus); s.off('order.updated'); };
    }
    if (step === 'browse') {
      loadMenuPublic();
    }
  }, [step, token]);

  async function loadMenuPublic() {
    const r = await fetch(`/api/v1/public/menu?qrToken=${encodeURIComponent(qrToken)}`);
    const j = await r.json();
    if (r.ok) {
      setCategories(j.data.categories);
      if (j.data.categories[0]) setActiveCat(j.data.categories[0].id);
    } else {
      setErr(j?.error?.message || 'Erro ao carregar cardápio');
    }
  }

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 3000); }

  async function checkin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/v1/public/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, name, phone }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || 'Erro no check-in');
      setToken(j.data.token); setSession(j.data.session);
      localStorage.setItem(`md:session:${qrToken}`, JSON.stringify(j.data));
      setStep('menu');
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  async function loadMenu() {
    const r = await fetch('/api/v1/public/menu', { headers: { 'x-session-token': token } });
    const j = await r.json();
    if (r.ok) {
      setCategories(j.data.categories);
      if (j.data.categories[0]) setActiveCat(j.data.categories[0].id);
    }
  }
  async function loadOrders() {
    const r = await fetch('/api/v1/public/orders', { headers: { 'x-session-token': token } });
    const j = await r.json();
    if (r.ok) setOrders(j.data.orders);
  }

  function addToCart(p: Product) {
    setCart((c) => {
      const ex = c.find((x) => x.productId === p.id);
      if (ex) return c.map((x) => x.productId === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
    showToast(`${p.name} adicionado`);
  }
  function changeQty(pid: string, delta: number) {
    setCart((c) => c.map((x) => x.productId === pid ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter((x) => x.quantity > 0));
  }
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.quantity, 0), [cart]);

  async function submitOrder() {
    if (!cart.length) return;
    setLoading(true);
    try {
      const r = await fetch('/api/v1/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify({ items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity, notes: x.notes })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || 'Erro');
      setCart([]); setCartOpen(false); showToast('Pedido enviado!'); loadOrders();
    } catch (e: any) { showToast(e.message); } finally { setLoading(false); }
  }

  async function call(type: 'waiter' | 'bill') {
    await fetch('/api/v1/public/calls', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      body: JSON.stringify({ type }),
    });
    showToast(type === 'waiter' ? 'Garçom chamado' : 'Pedido de conta enviado');
  }

  if (step === 'intro') {
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-2">🍔</div>
            <div className="text-3xl font-bold">Bem-vindo!</div>
            <p className="text-gray-400 mt-2 text-sm">O que você quer fazer agora?</p>
          </div>
          <button onClick={() => setStep('checkin')} className="card p-5 w-full text-left hover:border-brand-600 transition">
            <div className="text-xl font-bold">🍽️ Iniciar minha mesa</div>
            <p className="text-sm text-gray-400 mt-1">Abra uma conta, peça pelo app e acompanhe o preparo em tempo real.</p>
          </button>
          <button onClick={() => setStep('browse')} className="card p-5 w-full text-left hover:border-brand-600 transition">
            <div className="text-xl font-bold">📖 Apenas ver o cardápio</div>
            <p className="text-sm text-gray-400 mt-1">Explore os produtos sem fazer pedido ainda.</p>
          </button>
        </div>
      </main>
    );
  }

  if (step === 'checkin') {
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <form onSubmit={checkin} className="card p-6 w-full max-w-md">
          <button type="button" onClick={() => setStep('intro')} className="text-sm text-gray-400 mb-3">← Voltar</button>
          <div className="text-3xl font-bold mb-1">Iniciar mesa 👋</div>
          <p className="text-gray-400 mb-6 text-sm">Informe seus dados para começar</p>
          <label className="label">Nome do responsável</label>
          <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          <label className="label">Telefone</label>
          <input className="input mb-5" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="(11) 99999-9999" />
          {err && <div className="text-red-400 text-sm mb-3">{err}</div>}
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Entrando...' : 'Começar pedido'}</button>
        </form>
      </main>
    );
  }

  if (step === 'browse') {
    const activeCategoryBrowse = categories.find((c) => c.id === activeCat);
    return (
      <main className="min-h-screen pb-16">
        <header className="sticky top-0 z-20 bg-[color:var(--bg)]/90 backdrop-blur border-b border-[color:var(--border)] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Apenas visualização</div>
            <div className="text-lg font-bold">Cardápio</div>
          </div>
          <button onClick={() => setStep('intro')} className="btn btn-primary text-sm">Iniciar mesa</button>
        </header>
        {err && <div className="p-4 text-red-400 text-sm">{err}</div>}
        <div className="sticky top-[60px] z-10 bg-[color:var(--bg)]/90 backdrop-blur border-b border-[color:var(--border)] overflow-x-auto scroll-none px-3 py-2">
          <div className="flex gap-2">
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap text-sm ${activeCat === c.id ? 'bg-brand-600 text-white' : 'bg-[#1f1f2b] text-gray-300'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeCategoryBrowse?.products.map((p) => (
            <div key={p.id} className="card p-3 flex gap-3">
              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-[#1f1f2b]" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                {p.description && <div className="text-xs text-gray-400 line-clamp-2">{p.description}</div>}
                <div className="mt-1 text-brand-500 font-bold">{formatBRL(p.price)}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const activeCategory = categories.find((c) => c.id === activeCat);
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');

  return (
    <main className="min-h-screen pb-36">
      <header className="sticky top-0 z-20 bg-[color:var(--bg)]/90 backdrop-blur border-b border-[color:var(--border)] px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400">Mesa {session?.tableNumber} • {session?.customerName}</div>
          <div className="text-lg font-bold">Cardápio</div>
        </div>
        <button onClick={() => call('waiter')} className="btn btn-ghost text-sm">🙋 Garçom</button>
      </header>

      {orders.length > 0 && (
        <div className="px-4 pt-3">
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400">Seus pedidos ({orders.length})</div>
              <button onClick={() => setHistoryOpen(true)} className="text-xs text-brand-500 hover:underline">Ver todos</button>
            </div>
            <div className="flex flex-col gap-2">
              {activeOrders.slice(0, 3).map((o) => (
                <div key={o.id} className="flex items-center justify-between">
                  <div className="text-sm">#{o.sequenceNumber} • {formatBRL(o.total)}</div>
                  <span className={`badge ${o.status === 'ready' ? 'badge-ok' : o.status === 'preparing' ? 'badge-warn' : 'badge-info'}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))}
              {activeOrders.length === 0 && <div className="text-sm text-gray-500">Todos os pedidos foram entregues</div>}
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-[60px] z-10 bg-[color:var(--bg)]/90 backdrop-blur border-b border-[color:var(--border)] overflow-x-auto scroll-none px-3 py-2">
        <div className="flex gap-2">
          {categories.map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap text-sm ${activeCat === c.id ? 'bg-brand-600 text-white' : 'bg-[#1f1f2b] text-gray-300'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {activeCategory?.products.map((p) => (
          <button key={p.id} onClick={() => addToCart(p)} disabled={!p.available}
            className="card p-3 flex gap-3 text-left hover:border-brand-600 disabled:opacity-50">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-[#1f1f2b]" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.name}</div>
              {p.description && <div className="text-xs text-gray-400 line-clamp-2">{p.description}</div>}
              <div className="mt-1 text-brand-500 font-bold">{formatBRL(p.price)}</div>
              {!p.available && <div className="text-xs text-red-400">Indisponível</div>}
            </div>
          </button>
        ))}
      </div>

      {/* Cart floating button */}
      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 btn btn-primary shadow-xl">
          🛒 {cartCount} item(s) • {formatBRL(cartTotal)}
        </button>
      )}

      {/* Bottom FAB */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0b0b0f] border-t border-[color:var(--border)] p-3 flex gap-2">
        <button onClick={() => call('bill')} className="btn btn-ghost flex-1 text-sm">💳 Conta</button>
        <button onClick={() => call('waiter')} className="btn btn-ghost flex-1 text-sm">🙋 Garçom</button>
      </div>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setCartOpen(false)}>
          <div className="bg-[color:var(--card)] w-full rounded-t-2xl max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-xl font-bold">Seu pedido</div>
              <button onClick={() => setCartOpen(false)} className="text-gray-400">✕</button>
            </div>
            <div className="flex flex-col gap-2">
              {cart.map((x) => (
                <div key={x.productId} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{x.name}</div>
                    <div className="text-sm text-gray-400">{formatBRL(x.price * x.quantity)}</div>
                  </div>
                  <button onClick={() => changeQty(x.productId, -1)} className="btn btn-ghost px-3">−</button>
                  <span className="w-6 text-center">{x.quantity}</span>
                  <button onClick={() => changeQty(x.productId, 1)} className="btn btn-ghost px-3">+</button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-lg font-bold">
              <span>Total</span><span>{formatBRL(cartTotal)}</span>
            </div>
            <button onClick={submitOrder} disabled={loading} className="btn btn-primary w-full mt-4">
              {loading ? 'Enviando...' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setHistoryOpen(false)}>
          <div className="bg-[color:var(--card)] w-full rounded-t-2xl max-h-[85vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-xl font-bold">Histórico da mesa</div>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-400">✕</button>
            </div>
            {orders.length === 0 && <div className="text-gray-500 text-center py-8">Nenhum pedido ainda</div>}
            <div className="flex flex-col gap-3">
              {orders.map((o) => (
                <div key={o.id} className="card p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold">#{o.sequenceNumber}</div>
                      <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleTimeString('pt-BR')}</div>
                    </div>
                    <span className={`badge ${o.status === 'delivered' ? 'badge-ok' : o.status === 'ready' ? 'badge-ok' : o.status === 'cancelled' ? 'bg-red-600/20 text-red-300' : 'badge-warn'}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <ul className="text-sm space-y-1 mb-2">
                    {o.items.map((i: any, idx: number) => (
                      <li key={idx} className="flex justify-between">
                        <span>{i.quantity}× {i.name}</span>
                        <span className="text-gray-400">{formatBRL(Number(i.unitPrice) * i.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between border-t border-gray-800 pt-2 font-semibold">
                    <span>Total</span>
                    <span className="text-brand-500">{formatBRL(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
            {orders.length > 0 && (
              <div className="mt-4 card p-3 bg-brand-600/10 border-brand-600/30">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total da mesa</span>
                  <span className="text-brand-500">{formatBRL(orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 card px-4 py-2 text-sm z-50">{toast}</div>
      )}
    </main>
  );
}
