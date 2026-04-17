'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';
import { CashierSessionModal } from '@/components/CashierSessionModal';

type Tab = 'orders' | 'new' | 'bill';

const STATUS_LABEL: Record<string, string> = {
  received: 'Recebido', accepted: 'Aceito', preparing: 'Preparando',
  ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  received: 'bg-gray-600/30 text-gray-300',
  accepted: 'bg-blue-600/30 text-blue-300',
  preparing: 'bg-amber-600/30 text-amber-300',
  ready: 'bg-green-600/30 text-green-300',
  delivered: 'bg-emerald-800/30 text-emerald-300',
  cancelled: 'bg-red-700/30 text-red-300',
};

export function WaiterTableModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('orders');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);

  // Carrinho do novo pedido
  const [cart, setCart] = useState<{ productId: string; name: string; price: number; quantity: number; notes?: string }[]>([]);
  const [targetOrderId, setTargetOrderId] = useState<string>(''); // '' = novo pedido; id = adicionar a pedido existente
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => { load(); loadMenu(); }, [sessionId]);

  async function load() {
    try {
      // Usa endpoint de cashier que traz session + orders + items
      const d = await apiFetch(`/api/v1/cashier/sessions/${sessionId}`);
      setSession(d.session);
      setOrders(d.session.orders || []);
    } catch (e: any) { setErr(e.message); }
  }

  async function loadMenu() {
    try {
      const d = await apiFetch('/api/v1/admin/products?active=true');
      const cats = await apiFetch('/api/v1/admin/categories');
      const grouped: any[] = cats.categories.map((c: any) => ({
        ...c,
        products: d.products.filter((p: any) => p.categoryId === c.id && p.available),
      })).filter((c: any) => c.products.length > 0);
      setCategories(grouped);
      if (grouped[0]) setActiveCat(grouped[0].id);
    } catch {}
  }

  function addToCart(p: any) {
    setCart((c) => {
      const existing = c.find((x) => x.productId === p.id && !x.notes);
      if (existing) return c.map((x) => x === existing ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { productId: p.id, name: p.name, price: Number(p.price), quantity: 1 }];
    });
  }
  function changeCartQty(pid: string, delta: number) {
    setCart((c) => c.map((x) => x.productId === pid ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter((x) => x.quantity > 0));
  }

  async function submitNewOrder() {
    if (!cart.length) return;
    setBusy(true); setErr(null);
    try {
      if (targetOrderId) {
        await apiFetch(`/api/v1/waiter/orders/${targetOrderId}/items`, {
          method: 'POST',
          body: JSON.stringify({ items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity, notes: x.notes })) }),
        });
      } else {
        await apiFetch('/api/v1/waiter/orders', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity, notes: x.notes })),
          }),
        });
      }
      setCart([]); setTargetOrderId('');
      await load();
      setTab('orders');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function cancelItem(orderId: string, itemId: string) {
    const reason = prompt('Motivo do cancelamento do item (opcional):') || '';
    setBusy(true); setErr(null);
    try {
      await apiFetch(`/api/v1/waiter/orders/${orderId}/items/${itemId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function cancelFullOrder(orderId: string) {
    const reason = prompt('Motivo do cancelamento do pedido inteiro:') || '';
    if (!confirm(`Cancelar pedido inteiro?${reason ? `\nMotivo: ${reason}` : ''}`)) return;
    setBusy(true); setErr(null);
    try {
      await apiFetch(`/api/v1/waiter/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const all: any[] = [];
      for (const c of categories) for (const p of c.products) {
        if (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) all.push(p);
      }
      return all;
    }
    const cat = categories.find((c) => c.id === activeCat) || categories[0];
    return cat?.products || [];
  }, [categories, activeCat, search]);

  const cartTotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const cartCount = cart.reduce((s, x) => s + x.quantity, 0);

  if (!session) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="card p-6">Carregando...</div>
      </div>
    );
  }

  const activeOrders = orders.filter((o: any) => !['cancelled', 'delivered'].includes(o.status));

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4" onClick={onClose}>
        <div
          className="bg-[#0b0b0f] border border-[color:var(--border)] w-full md:max-w-5xl md:rounded-2xl shadow-2xl flex flex-col max-h-screen md:max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border)]">
            <div>
              <div className="text-xs text-gray-500">
                Mesa {session.table?.number}{session.table?.label ? ` · ${session.table.label}` : ''}
              </div>
              <div className="text-xl font-bold">{session.customerName || 'Cliente'}</div>
              <div className="text-xs text-gray-400">
                {orders.length} pedido(s) · Total {formatBRL(session.subtotal)}
                {session.remaining > 0 && <span className="text-amber-400"> · Restante {formatBRL(session.remaining)}</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 text-2xl leading-none px-3">×</button>
          </header>

          {/* Tabs */}
          <div className="flex gap-1 px-3 pt-2 border-b border-[color:var(--border)]">
            <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} label={`📋 Pedidos (${orders.length})`} />
            <TabBtn active={tab === 'new'} onClick={() => setTab('new')} label={`➕ Adicionar ${cartCount > 0 ? `(${cartCount})` : ''}`} highlight={cartCount > 0} />
            <TabBtn active={tab === 'bill'} onClick={() => { setTab('bill'); setShowBillModal(true); }} label="💳 Fechar conta" />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {err && <div className="mb-3 bg-red-600/20 border border-red-600/40 text-red-300 text-sm rounded-lg p-3">{err}</div>}

            {tab === 'orders' && (
              <OrdersList
                orders={orders}
                onCancelItem={cancelItem}
                onCancelOrder={cancelFullOrder}
                onAddToOrder={(id: string) => { setTargetOrderId(id); setTab('new'); }}
                busy={busy}
              />
            )}

            {tab === 'new' && (
              <NewOrderTab
                categories={categories}
                activeCat={activeCat}
                onChangeCat={setActiveCat}
                search={search}
                onSearch={setSearch}
                filteredProducts={filteredProducts}
                onAddProduct={addToCart}
                cart={cart}
                onChangeQty={changeCartQty}
                cartTotal={cartTotal}
                cartCount={cartCount}
                targetOrderId={targetOrderId}
                activeOrders={activeOrders}
                onChangeTarget={setTargetOrderId}
                onSubmit={submitNewOrder}
                busy={busy}
              />
            )}
          </div>
        </div>
      </div>

      {showBillModal && (
        <CashierSessionModal sessionId={sessionId} onClose={() => { setShowBillModal(false); load(); }} />
      )}
    </>
  );
}

function TabBtn({ active, onClick, label, highlight }: { active: boolean; onClick: () => void; label: string; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
        active ? 'border-brand-500 text-white' : `border-transparent ${highlight ? 'text-brand-400' : 'text-gray-400 hover:text-white'}`
      }`}
    >
      {label}
    </button>
  );
}

function OrdersList({
  orders, onCancelItem, onCancelOrder, onAddToOrder, busy,
}: any) {
  if (orders.length === 0) {
    return <div className="text-center text-gray-500 py-10">Nenhum pedido nesta mesa ainda.</div>;
  }
  return (
    <div className="space-y-3">
      {orders.map((o: any) => {
        const cancelled = o.status === 'cancelled';
        const canModify = !['delivered', 'cancelled'].includes(o.status);
        return (
          <div key={o.id} className={`card p-3 ${cancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">#{o.sequenceNumber}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] || 'bg-gray-700 text-gray-300'}`}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
                <span className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex gap-1">
                {canModify && (
                  <>
                    <button onClick={() => onAddToOrder(o.id)} disabled={busy}
                      className="text-xs px-2 py-1 rounded bg-brand-600/20 text-brand-300 hover:bg-brand-600/40 transition">
                      + item
                    </button>
                    <button onClick={() => onCancelOrder(o.id)} disabled={busy}
                      className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/40 transition">
                      Cancelar pedido
                    </button>
                  </>
                )}
              </div>
            </div>
            <ul className="text-sm space-y-1">
              {o.items.map((i: any) => {
                const itemCancelled = i.status === 'cancelled';
                return (
                  <li key={i.id} className={`flex items-center justify-between gap-2 ${itemCancelled ? 'line-through text-gray-500' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-400">{i.quantity}×</span> {i.name}
                      {i.notes && <div className="text-xs text-amber-400 italic ml-5">📝 {i.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-400 text-sm whitespace-nowrap">{formatBRL(Number(i.unitPrice) * i.quantity)}</span>
                      {canModify && !itemCancelled && (
                        <button onClick={() => onCancelItem(o.id, i.id)} disabled={busy}
                          className="text-red-400 text-xs hover:underline">
                          cancelar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 pt-2 border-t border-[color:var(--border)] text-right text-sm">
              Total <b>{formatBRL(Number(o.total))}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewOrderTab({
  categories, activeCat, onChangeCat, search, onSearch, filteredProducts,
  onAddProduct, cart, onChangeQty, cartTotal, cartCount,
  targetOrderId, activeOrders, onChangeTarget, onSubmit, busy,
}: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
      <div>
        <input
          className="input mb-2"
          placeholder="🔍 Buscar produto..."
          value={search}
          onChange={(e: any) => onSearch(e.target.value)}
        />
        {!search && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mb-3 pb-2">
            {categories.map((c: any) => (
              <button key={c.id} onClick={() => onChangeCat(c.id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap text-sm transition ${
                  activeCat === c.id ? 'bg-brand-600 text-white' : 'bg-[#1f1f2b] text-gray-300 hover:bg-[#2a2a3a]'
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredProducts.map((p: any) => (
            <button key={p.id} onClick={() => onAddProduct(p)}
              className="card p-2 flex gap-2 items-center text-left hover:border-brand-500 transition">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded bg-[#1f1f2b] flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-brand-500 font-bold text-sm">{formatBRL(Number(p.price))}</div>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500 text-sm">
              {search ? `Nenhum produto para "${search}"` : 'Nenhum produto disponível'}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0f0f17] border border-[color:var(--border)] rounded-xl p-3 flex flex-col max-h-[60vh]">
        <div className="mb-3">
          <label className="label">Destino</label>
          <select className="input text-sm" value={targetOrderId} onChange={(e: any) => onChangeTarget(e.target.value)}>
            <option value="">🆕 Novo pedido</option>
            {activeOrders.map((o: any) => (
              <option key={o.id} value={o.id}>
                ➕ Adicionar ao #{o.sequenceNumber} ({STATUS_LABEL[o.status]})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 mb-2">
          {cart.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-6">
              Toque em produtos para adicionar.
            </div>
          )}
          {cart.map((x: any) => (
            <div key={x.productId} className="bg-[#1f1f2b] rounded p-2">
              <div className="flex justify-between text-sm">
                <div className="flex-1 min-w-0 truncate">{x.name}</div>
                <div className="text-brand-500 font-semibold">{formatBRL(x.price * x.quantity)}</div>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <button onClick={() => onChangeQty(x.productId, -1)}
                  className="w-7 h-7 rounded bg-[#0b0b0f] text-sm">−</button>
                <span className="min-w-[24px] text-center text-sm font-bold">{x.quantity}</span>
                <button onClick={() => onChangeQty(x.productId, 1)}
                  className="w-7 h-7 rounded bg-[#0b0b0f] text-sm">+</button>
                <span className="flex-1" />
                <span className="text-xs text-gray-500">{formatBRL(x.price)} cada</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--border)] pt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <b className="text-brand-500">{formatBRL(cartTotal)}</b>
          </div>
          <button
            onClick={onSubmit}
            disabled={busy || cart.length === 0}
            className="btn btn-primary w-full"
          >
            {busy ? 'Enviando...' : targetOrderId ? `Adicionar ao pedido (${cartCount})` : `Criar pedido (${cartCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
