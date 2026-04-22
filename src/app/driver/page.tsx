'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bike, LogOut, MapPin, Phone, Package, CheckCircle2, Loader2,
  RefreshCw, History, Navigation, BarChart3,
} from 'lucide-react';
import { getSocket, joinRooms } from '@/lib/socket-client';

type Tab = 'active' | 'history';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ready: { label: '📦 Pronto p/ retirar', color: 'bg-green-600/20 text-green-400' },
  dispatched: { label: '🛵 Em rota', color: 'bg-purple-600/20 text-purple-400' },
  delivered: { label: '✨ Entregue', color: 'bg-gray-700 text-gray-300' },
  cancelled: { label: '❌ Cancelado', color: 'bg-red-600/20 text-red-400' },
};

export default function DriverPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadMe = async () => {
    const res = await fetch('/api/v1/driver/auth/me');
    if (!res.ok) {
      router.replace('/driver/login');
      return null;
    }
    const body = await res.json();
    setDriver(body.data.driver);
    return body.data.driver;
  };

  const loadOrders = async (t: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/driver/orders?status=${t}`);
      if (res.status === 401) {
        router.replace('/driver/login');
        return;
      }
      const body = await res.json();
      setOrders(body.data?.orders || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe().then((d) => { if (d) loadOrders(tab); });
  }, []);

  useEffect(() => {
    if (driver) loadOrders(tab);
  }, [tab]);

  // Auto-refresh lento como fallback (socket.io é a fonte primária de eventos)
  useEffect(() => {
    if (tab !== 'active' || !driver) return;
    const t = setInterval(() => loadOrders('active'), 60_000);
    return () => clearInterval(t);
  }, [tab, driver]);

  // Socket.io: escuta eventos do motoboy em tempo real
  useEffect(() => {
    if (!driver?.id) return;
    joinRooms([`driver:${driver.id}`]);
    const sock = getSocket();
    const reload = () => { if (tab === 'active') loadOrders('active'); };
    const onAssigned = (p: any) => {
      reload();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('📦 Nova entrega atribuída', {
          body: `#${p?.sequenceNumber ?? ''} — ${p?.customerName ?? ''}`,
          tag: `order-${p?.orderId}`,
        });
      }
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 350);
      } catch {}
    };
    sock.on('order.assigned', onAssigned);
    sock.on('order.unassigned', reload);
    sock.on('order.status_changed', reload);
    sock.on('order.updated', reload);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      sock.off('order.assigned', onAssigned);
      sock.off('order.unassigned', reload);
      sock.off('order.status_changed', reload);
      sock.off('order.updated', reload);
    };
  }, [driver?.id, tab]);

  // Geolocalização em tempo-real: enquanto houver entrega `dispatched`, envia coord ao servidor
  const hasInTransit = orders.some((o) => o.status === 'dispatched');
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  useEffect(() => {
    if (!driver?.id || !hasInTransit || typeof navigator === 'undefined' || !navigator.geolocation) {
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    const push = async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastSentRef.current < 10_000) return;
      lastSentRef.current = now;
      try {
        await fetch('/api/v1/driver/location', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });
      } catch {}
    };
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => push(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 8_000, timeout: 20_000 },
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [driver?.id, hasInTransit]);

  const handleLogout = async () => {
    await fetch('/api/v1/driver/auth/me', { method: 'POST' });
    router.replace('/driver/login');
  };

  const handleStatus = async (orderId: string, status: 'dispatched' | 'delivered') => {
    const confirmMsg = status === 'dispatched'
      ? 'Confirma que saiu para esta entrega?'
      : 'Confirma que ENTREGOU este pedido?';
    if (!confirm(confirmMsg)) return;

    setBusyId(orderId);
    try {
      const res = await fetch(`/api/v1/driver/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error?.message || body.error || 'Erro');
        return;
      }
      await loadOrders(tab);
    } finally {
      setBusyId(null);
    }
  };

  const readyOrders = orders.filter((o) => o.status === 'ready');
  const handleDispatchAll = async () => {
    if (readyOrders.length === 0) return;
    if (!confirm(`Sair para entrega com ${readyOrders.length} pedido(s)? Use esta opção quando for entregar vários na mesma viagem.`)) return;
    setBusyId('__all__');
    try {
      for (const o of readyOrders) {
        await fetch(`/api/v1/driver/orders/${o.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'dispatched' }),
        });
      }
      await loadOrders(tab);
    } finally {
      setBusyId(null);
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--border)] p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Bike className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="font-bold">{driver.name}</h1>
              <p className="text-xs text-gray-400">
                {driver.totalDeliveries} entrega{driver.totalDeliveries !== 1 ? 's' : ''} no total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/driver/stats"
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded"
              title="Estatísticas"
            >
              <BarChart3 className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex gap-1 border-b border-[var(--border)]">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
              tab === 'active'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400'
            }`}
          >
            <Package className="w-4 h-4" /> Ativas
            {tab === 'active' && orders.length > 0 && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
              tab === 'history'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400'
            }`}
          >
            <History className="w-4 h-4" /> Histórico
          </button>
          <button
            onClick={() => loadOrders(tab)}
            className="ml-auto p-2 text-gray-400 hover:text-gray-200"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lista */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading && orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            {tab === 'active'
              ? 'Nenhuma entrega atribuída agora. 😴'
              : 'Sem histórico ainda.'}
          </div>
        ) : (
          <div className="space-y-3">
            {tab === 'active' && readyOrders.length >= 2 && (
              <button
                onClick={handleDispatchAll}
                disabled={busyId === '__all__'}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {busyId === '__all__'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <>🛵 Saí com {readyOrders.length} entregas na viagem</>}
              </button>
            )}
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onDispatch={() => handleStatus(o.id, 'dispatched')}
                onDeliver={() => handleStatus(o.id, 'delivered')}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({
  order, busy, onDispatch, onDeliver,
}: {
  order: any; busy: boolean; onDispatch: () => void; onDeliver: () => void;
}) {
  const status = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-gray-700 text-gray-300' };
  const mapUrl = order.deliveryLat && order.deliveryLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLat},${order.deliveryLng}`
    : order.deliveryAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`
      : null;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg">#{order.sequenceNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
              {status.label}
            </span>
            {order.paymentStatus === 'paid' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">
                💳 Pago
              </span>
            )}
          </div>
          <div className="text-sm text-gray-200 mt-1 font-medium">{order.customerName}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-orange-400">{formatBRL(order.total)}</div>
          <div className="text-xs text-gray-400">
            {order.itemsCount} item{order.itemsCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {order.deliveryAddress && (
        <div className="mt-3 p-3 bg-black/20 border border-[var(--border)] rounded-lg">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-gray-200">
              {order.deliveryAddress}
              {order.distanceKm && (
                <span className="text-xs text-gray-400 block mt-0.5">
                  ~{order.distanceKm.toFixed(1)} km da loja
                </span>
              )}
            </div>
          </div>
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 text-sm font-medium"
            >
              <Navigation className="w-4 h-4" /> Abrir no Google Maps
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2 flex-wrap items-center text-sm">
        {order.customerPhone && (
          <a
            href={`tel:${order.customerPhone}`}
            className="flex items-center gap-1 text-orange-400 hover:underline"
          >
            <Phone className="w-4 h-4" /> {order.customerPhone}
          </a>
        )}
        {order.customerPhone && (
          <a
            href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:underline"
          >
            💬 WhatsApp
          </a>
        )}
      </div>

      {order.paymentMethod && (
        <div className="mt-3 text-sm text-gray-300">
          <span className="text-gray-400">Pagamento: </span>
          <span className="font-medium">{order.paymentMethod.toUpperCase()}</span>
          {order.changeFor && (
            <span className="text-yellow-400 ml-2">
              (troco para {formatBRL(order.changeFor)})
            </span>
          )}
        </div>
      )}

      {order.notes && (
        <div className="mt-2 text-sm text-gray-300 bg-yellow-600/10 border border-yellow-500/30 p-2 rounded">
          📝 {order.notes}
        </div>
      )}

      <details className="mt-3">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-200">
          Ver itens do pedido
        </summary>
        <div className="mt-2 text-sm space-y-0.5 text-gray-300">
          {order.items.map((i: any, idx: number) => (
            <div key={idx}>• {i.quantity}x {i.name}</div>
          ))}
        </div>
      </details>

      {/* Ações */}
      {order.status === 'ready' && (
        <button
          onClick={onDispatch}
          disabled={busy}
          className="btn btn-primary w-full mt-3 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🛵 Saí para entrega</>}
        </button>
      )}
      {order.status === 'dispatched' && (
        <button
          onClick={onDeliver}
          disabled={busy}
          className="btn w-full mt-3 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como entregue</>}
        </button>
      )}
    </div>
  );
}
