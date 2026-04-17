'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { formatBRL } from '@/lib/format';

import { MenuTab } from './_components/MenuTab';
import { OrdersTab } from './_components/OrdersTab';
import { BillTab } from './_components/BillTab';
import { CartDrawer } from './_components/CartDrawer';
import { ProductModal } from './_components/ProductModal';
import { CallWaiterModal } from './_components/CallWaiterModal';
import { BillRequestModal } from './_components/BillRequestModal';
import type { Category, Product, CartItem, Order, Call, Unit } from './_components/types';
import { STATUS_LABEL } from './_components/types';

type Tab = 'menu' | 'orders' | 'bill';

export default function ClientPage() {
  const params = useParams<{ token: string }>();
  const qrToken = params.token;

  // -- State --
  const [step, setStep] = useState<'intro' | 'checkin' | 'menu' | 'browse'>('intro');
  const [tab, setTab] = useState<Tab>('menu');
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [unit, setUnit] = useState<Unit>({ primaryColor: '#f97316' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // -- UI Control --
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showCallWaiter, setShowCallWaiter] = useState(false);
  const [showBillRequest, setShowBillRequest] = useState(false);
  const [readyAlert, setReadyAlert] = useState<Order | null>(null);

  // -- Checkin State --
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const primaryColor = unit.primaryColor || '#f97316';

  // -- Init & Data Loading --
  useEffect(() => {
    const saved = localStorage.getItem(`md:session:${qrToken}`);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setToken(d.token);
        setSession(d.session);
        setStep('menu');
      } catch {}
    }
    loadUnit();
  }, [qrToken]);

  useEffect(() => {
    if (step === 'menu' && token) {
      loadAll();
      joinRooms([`session:${session.id}`]);
      const s = getSocket();
      s.on('order.status_changed', (p) => {
        loadOrders();
        showToast(`Pedido #${p.sequenceNumber}: ${STATUS_LABEL[p.status] || p.status}`);
      });
      s.on('order.ready', (p) => {
        loadOrders();
        setReadyAlert(p);
        playBeep();
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      });
      s.on('call.attended', () => {
        loadCalls();
        showToast('Chamada atendida!');
      });

      // Polling de fallback para chamadas
      const t = setInterval(loadCalls, 30000);
      return () => {
        s.off('order.status_changed');
        s.off('order.ready');
        s.off('call.attended');
        clearInterval(t);
      };
    } else if (step === 'browse' || step === 'intro') {
      loadMenuPublic();
    }
  }, [step, token]);

  async function loadUnit() {
    try {
      const r = await fetch(`/api/v1/public/unit?qrToken=${qrToken}`);
      const j = await r.json();
      if (r.ok) setUnit(j.data);
    } catch {}
  }

  async function loadMenuPublic() {
    try {
      const r = await fetch(`/api/v1/public/menu?qrToken=${qrToken}`);
      const j = await r.json();
      if (r.ok) setCategories(j.data.categories);
    } catch {}
  }

  async function loadAll() {
    loadMenu();
    loadOrders();
    loadCalls();
  }

  async function loadMenu() {
    const r = await fetch('/api/v1/public/menu', { headers: { 'x-session-token': token } });
    const j = await r.json();
    if (r.ok) setCategories(j.data.categories);
  }

  async function loadOrders() {
    const r = await fetch('/api/v1/public/orders', { headers: { 'x-session-token': token } });
    const j = await r.json();
    if (r.ok) setOrders(j.data.orders);
  }

  async function loadCalls() {
    const r = await fetch('/api/v1/public/calls', { headers: { 'x-session-token': token } });
    const j = await r.json();
    if (r.ok) setCalls(j.data.calls);
  }

  // -- Handlers --
  async function handleCheckin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/v1/public/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, name, phone }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || 'Erro no check-in');
      setToken(j.data.token);
      setSession(j.data.session);
      localStorage.setItem(`md:session:${qrToken}`, JSON.stringify(j.data));
      setStep('menu');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function handleAddToCart(p: Product, quantity: number, notes: string) {
    setCart((prev) => {
      // Dedupe: se já existe item igual (mesmo produto e mesma observação), soma
      const existing = prev.find((x) => x.productId === p.id && x.notes === notes);
      if (existing) {
        return prev.map((x) => x === existing ? { ...x, quantity: x.quantity + quantity } : x);
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity, notes, imageUrl: p.imageUrl }];
    });
    showToast(`${p.name} adicionado ao carrinho`);
  }

  async function handleSubmitOrder() {
    if (!cart.length) return;
    setLoading(true);
    try {
      const r = await fetch('/api/v1/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify({ items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity, notes: x.notes })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || 'Erro ao enviar pedido');
      setCart([]);
      setCartOpen(false);
      showToast('Pedido enviado com sucesso!');
      loadOrders();
      setTab('orders');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCallWaiter(reason: string) {
    const r = await fetch('/api/v1/public/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      body: JSON.stringify({ type: 'waiter', reason }),
    });
    if (r.ok) {
      showToast('Garçom chamado!');
      loadCalls();
    }
  }

  async function handleBillRequest(paymentHint: string, splitCount?: number) {
    const r = await fetch('/api/v1/public/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      body: JSON.stringify({ type: 'bill', paymentHint, splitCount }),
    });
    if (r.ok) {
      showToast('Pedido de conta enviado!');
      loadCalls();
    }
  }

  async function handleCancelCall(id: string) {
    const r = await fetch(`/api/v1/public/calls?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-session-token': token },
    });
    if (r.ok) {
      showToast('Chamada cancelada');
      loadCalls();
    }
  }

  // -- Utils --
  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 3000); }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }

  // -- UI Parts --
  if (step === 'intro') {
    return (
      <main className="min-h-screen flex items-center justify-center p-5 bg-[#0b0b0f] text-white">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            {unit.logoUrl ? (
              <img src={unit.logoUrl} alt={unit.name} className="h-20 mx-auto mb-4" />
            ) : (
              <div className="text-5xl mb-4">🍔</div>
            )}
            <h1 className="text-3xl font-black">{unit.name || 'Mesa Digital'}</h1>
            <p className="text-gray-400 mt-2">Bem-vindo ao nosso autoatendimento!</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => setStep('checkin')} className="card p-5 w-full text-left hover:border-brand-600 transition flex items-center gap-4">
              <span className="text-3xl">🍽️</span>
              <div>
                <div className="text-xl font-bold">Iniciar mesa</div>
                <div className="text-xs text-gray-400">Fazer pedidos e acompanhar conta</div>
              </div>
            </button>
            <button onClick={() => setStep('browse')} className="card p-5 w-full text-left hover:border-brand-600 transition flex items-center gap-4">
              <span className="text-3xl">📖</span>
              <div>
                <div className="text-xl font-bold">Apenas cardápio</div>
                <div className="text-xs text-gray-400">Ver fotos e preços sem pedir</div>
              </div>
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 'checkin') {
    return (
      <main className="min-h-screen flex flex-col p-6 bg-[#0b0b0f] text-white">
        <button onClick={() => setStep('intro')} className="text-gray-400 mb-8 self-start">← Voltar</button>
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-3xl font-black mb-1">Iniciar Mesa 🍽️</h2>
          <p className="text-gray-400 mb-8">Informe seus dados para identificação dos pedidos.</p>
          <form onSubmit={handleCheckin} className="space-y-4">
            <div>
              <label className="label">Seu Nome</label>
              <input className="input" placeholder="Ex: João Silva" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input className="input" type="tel" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            {err && <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{err}</div>}
            <button className="btn btn-primary w-full py-4 text-lg font-bold" disabled={loading} style={{ backgroundColor: primaryColor }}>
              {loading ? 'Entrando...' : 'Começar a Pedir'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (step === 'browse') {
    return (
      <main className="min-h-screen bg-[#0b0b0f] text-white">
        <header className="sticky top-0 z-30 bg-[#0b0b0f]/95 backdrop-blur-md border-b border-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {unit.logoUrl && <img src={unit.logoUrl} alt="" className="h-8" />}
            <span className="font-bold">Cardápio</span>
          </div>
          <button onClick={() => setStep('checkin')} className="btn btn-primary py-1.5 px-4 text-xs" style={{ backgroundColor: primaryColor }}>
            Iniciar Mesa
          </button>
        </header>
        <MenuTab categories={categories} onSelectProduct={(p) => { setSelectedProduct(p); }} primaryColor={primaryColor} />
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={() => setStep('checkin')} primaryColor={primaryColor} />
      </main>
    );
  }

  // -- Main View (step === 'menu') --
  const subtotal = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0);
  const activeOrdersCount = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const pendingCallsCount = calls.filter((c) => c.status === 'pending').length;

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      {/* Header Fixo */}
      <header className="sticky top-0 z-30 bg-[#0b0b0f]/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {unit.logoUrl ? (
            <img src={unit.logoUrl} alt="" className="h-8 w-auto" />
          ) : (
            <span className="text-2xl">🍔</span>
          )}
          <div>
            <div className="text-xs text-gray-500 leading-none">Mesa {session?.tableNumber}</div>
            <div className="font-bold text-sm truncate max-w-[120px]">{session?.customerName}</div>
          </div>
        </div>
        <button onClick={() => setTab('bill')} className="bg-[#1f1f2b] px-3 py-1.5 rounded-xl text-right">
          <div className="text-[10px] text-gray-500 leading-none">CONTA PARCIAL</div>
          <div className="font-black text-sm" style={{ color: primaryColor }}>{formatBRL(subtotal)}</div>
        </button>
      </header>

      {/* Conteúdo das Abas */}
      <div className={tab === 'menu' ? 'block' : 'hidden'}>
        <MenuTab categories={categories} onSelectProduct={setSelectedProduct} primaryColor={primaryColor} />
      </div>
      <div className={tab === 'orders' ? 'block' : 'hidden'}>
        <OrdersTab orders={orders} primaryColor={primaryColor} onGoToMenu={() => setTab('menu')} />
      </div>
      <div className={tab === 'bill' ? 'block' : 'hidden'}>
        <BillTab
          session={session}
          orders={orders}
          subtotal={subtotal}
          serviceFee={subtotal * (unit.serviceFee || 0) / 100}
          total={subtotal * (1 + (unit.serviceFee || 0) / 100)}
          serviceFeePct={(unit.serviceFee || 0) / 100}
          calls={calls}
          onCallWaiter={() => setShowCallWaiter(true)}
          onRequestBill={() => setShowBillRequest(true)}
          onCancelCall={handleCancelCall}
          primaryColor={primaryColor}
        />
      </div>

      {/* Carrinho FAB */}
      {tab === 'menu' && cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 btn btn-primary px-6 py-4 shadow-2xl flex items-center gap-3 active:scale-95 transition"
          style={{ backgroundColor: primaryColor }}
        >
          <span className="text-xl">🛒</span>
          <span className="font-bold">{cart.reduce((s, x) => s + x.quantity, 0)} itens • {formatBRL(cart.reduce((s, x) => s + x.price * x.quantity, 0))}</span>
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b0b0f]/95 backdrop-blur-md border-t border-gray-800 px-6 py-3 pb-6 flex justify-between items-center">
        <NavBtn active={tab === 'menu'} onClick={() => setTab('menu')} icon="🍽️" label="Cardápio" color={primaryColor} />
        <NavBtn
          active={tab === 'orders'}
          onClick={() => setTab('orders')}
          icon="📋"
          label="Pedidos"
          color={primaryColor}
          badge={activeOrdersCount > 0 ? activeOrdersCount : undefined}
        />
        <NavBtn
          active={tab === 'bill'}
          onClick={() => setTab('bill')}
          icon="💳"
          label="Conta"
          color={primaryColor}
          badge={pendingCallsCount > 0 ? pendingCallsCount : undefined}
        />
      </nav>

      {/* Modais */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={handleAddToCart}
        primaryColor={primaryColor}
      />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onChangeQty={(pid, delta) => {
          setCart((prev) => prev.map((x) => x.productId === pid ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter((x) => x.quantity > 0));
        }}
        onRemove={(pid) => {
          setCart((prev) => prev.filter((x) => x.productId !== pid));
        }}
        onEditNotes={(pid, notes) => {
          setCart((prev) => prev.map((x) => x.productId === pid ? { ...x, notes } : x));
        }}
        onClear={() => setCart([])}
        onSubmit={handleSubmitOrder}
        submitting={loading}
        primaryColor={primaryColor}
      />
      <CallWaiterModal
        open={showCallWaiter}
        onClose={() => setShowCallWaiter(false)}
        onConfirm={handleCallWaiter}
        primaryColor={primaryColor}
      />
      <BillRequestModal
        open={showBillRequest}
        onClose={() => setShowBillRequest(false)}
        onConfirm={handleBillRequest}
        total={subtotal * (1 + (unit.serviceFee || 0) / 100)}
        enabledMethods={(unit.paymentMethods || '').split(',').filter(Boolean)}
        primaryColor={primaryColor}
      />

      {/* Alerta de Pedido Pronto */}
      {readyAlert && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6" onClick={() => setReadyAlert(null)}>
          <div className="bg-green-600 text-white rounded-3xl p-8 text-center max-w-sm w-full animate-bounce shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-7xl mb-4">🔔</div>
            <h3 className="text-3xl font-black mb-2">Pedido Pronto!</h3>
            <p className="text-xl opacity-90 mb-8">Seu pedido <b>#{readyAlert.sequenceNumber}</b> está pronto. Você já pode retirá-lo!</p>
            <button onClick={() => setReadyAlert(null)} className="w-full bg-white text-green-700 font-bold py-4 rounded-2xl text-lg shadow-xl">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-full shadow-xl border border-gray-700 animate-fade-in text-sm whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  );
}

function NavBtn({ active, onClick, icon, label, color, badge }: any) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center gap-1 min-w-[64px] group">
      <div className={`text-2xl transition-transform group-active:scale-90 ${active ? '' : 'grayscale'}`}>{icon}</div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? '' : 'text-gray-500'}`} style={active ? { color } : undefined}>
        {label}
      </span>
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[#0b0b0f]">
          {badge}
        </span>
      )}
      {active && (
        <div className="absolute -bottom-3 w-8 h-1 rounded-t-full" style={{ backgroundColor: color }} />
      )}
    </button>
  );
}
