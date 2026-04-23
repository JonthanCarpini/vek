'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle2, Clock, ChefHat, Package, Bike, Check, MapPin } from 'lucide-react';
import { getSocket, joinRooms } from '@/lib/socket-client';

// Leaflet é carregado só no cliente para evitar erro de window durante SSR
const LiveDeliveryMap = dynamic(
  () => import('./LiveDeliveryMap').then((m) => m.LiveDeliveryMap),
  { ssr: false, loading: () => <div className="h-[300px] rounded-xl bg-gray-100 animate-pulse" /> },
);

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const STEPS = [
  { id: 'received', label: 'Pedido recebido', icon: CheckCircle2 },
  { id: 'accepted', label: 'Confirmado', icon: Clock },
  { id: 'preparing', label: 'Em preparo', icon: ChefHat },
  { id: 'ready', label: 'Pronto', icon: Package },
  { id: 'dispatched', label: 'Saiu para entrega', icon: Bike },
  { id: 'delivered', label: 'Entregue', icon: Check },
];

const STEP_ORDER: Record<string, number> = {
  received: 0, accepted: 1, preparing: 2, ready: 3, dispatched: 4, delivered: 5, cancelled: -1,
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface OrderTrackingViewProps {
  orderId: string;
  /** Título exibido no hero (ex: "Pedido" ou "Acompanhamento de pedido") */
  heroLabel?: string;
  /** Se true, oculta o hero gradiente e usa layout inline (ex: dentro da tab) */
  inline?: boolean;
}

export function OrderTrackingView({
  orderId, heroLabel = 'Pedido', inline = false,
}: OrderTrackingViewProps) {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/delivery/orders/${orderId}`);
        const body = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setError(body.error?.message || body.error || 'Pedido não encontrado');
        } else {
          setOrder(body.data.order);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15_000);

    joinRooms([`order:${orderId}`]);
    const sock = getSocket();
    const onLocation = (p: any) => {
      if (p?.orderId !== orderId) return;
      setOrder((o: any) => o ? {
        ...o,
        driver: o.driver ? { ...o.driver, currentLat: p.lat, currentLng: p.lng, lastLocationAt: p.at } : o.driver,
      } : o);
    };
    const onUpdate = () => load();
    sock.on('driver.location', onLocation);
    sock.on('order.status_changed', onUpdate);
    sock.on('order.updated', onUpdate);

    return () => {
      mounted = false;
      clearInterval(interval);
      sock.off('driver.location', onLocation);
      sock.off('order.status_changed', onUpdate);
      sock.off('order.updated', onUpdate);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Pedido não encontrado</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const currentStep = STEP_ORDER[order.status] ?? 0;
  const isCancelled = order.status === 'cancelled';
  const isTakeout = order.orderType === 'takeout';
  const visibleSteps = isTakeout ? STEPS.filter((s) => s.id !== 'dispatched') : STEPS;

  return (
    <div className="bg-gray-50">
      {!inline && (
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6">
          <p className="text-sm opacity-90">{heroLabel}</p>
          <h1 className="text-3xl font-bold">#{order.sequenceNumber}</h1>
          <p className="mt-2 text-sm opacity-90">
            {isTakeout ? 'Retirada no balcão' : 'Entrega em domicílio'}
          </p>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {inline && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{heroLabel}</p>
              <h1 className="text-2xl font-bold text-gray-800">#{order.sequenceNumber}</h1>
            </div>
            <span className="text-sm text-gray-600">
              {isTakeout ? '🛍️ Retirada' : '🛵 Entrega'}
            </span>
          </div>
        )}

        {isCancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
            <h2 className="font-bold mb-1">Pedido cancelado</h2>
            <p className="text-sm">Entre em contato com o estabelecimento para mais informações.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-4">Status do pedido</h2>
            <div className="space-y-3">
              {visibleSteps.map((step, idx) => {
                const active = idx <= currentStep;
                const current = idx === currentStep;
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                        active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
                      } ${current ? 'ring-4 ring-orange-200 animate-pulse' : ''}`}
                    >
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm ${active ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {order.driver && (
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">🛵 Entregador</h2>
              {order.status === 'dispatched' &&
                order.driver.currentLat != null && order.driver.currentLng != null && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  ao vivo
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mt-1">{order.driver.name}</p>
            {order.driver.phone && (
              <a href={`tel:${order.driver.phone}`} className="text-sm text-orange-600 hover:underline">
                {order.driver.phone}
              </a>
            )}
            {order.status === 'dispatched' &&
              order.driver.currentLat != null && order.driver.currentLng != null &&
              order.deliveryLat != null && order.deliveryLng != null && (
                <div className="mt-3">
                  <LiveDeliveryMap
                    driverLat={order.driver.currentLat}
                    driverLng={order.driver.currentLng}
                    destLat={order.deliveryLat}
                    destLng={order.deliveryLng}
                    height={280}
                  />
                  <DriverDistance
                    driverLat={order.driver.currentLat}
                    driverLng={order.driver.currentLng}
                    destLat={order.deliveryLat}
                    destLng={order.deliveryLng}
                    lastLocationAt={order.driver.lastLocationAt}
                  />
                </div>
            )}
          </div>
        )}

        {order.estimatedDeliveryAt && !isCancelled && order.status !== 'delivered' && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-1">⏱️ Previsão de {isTakeout ? 'retirada' : 'entrega'}</h2>
            <p className="text-2xl font-bold text-orange-600">
              {new Date(order.estimatedDeliveryAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-3">Resumo</h2>
          <div className="space-y-2 text-sm">
            {order.items.map((i: any) => (
              <div key={i.id} className="flex justify-between">
                <span className="text-gray-700">{i.quantity}x {i.name}</span>
                <span className="text-gray-700">{formatBRL(i.totalPrice)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatBRL(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega</span>
                <span>{formatBRL(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1">
              <span>Total</span>
              <span className="text-orange-600">{formatBRL(order.total)}</span>
            </div>
          </div>
        </div>

        {order.deliveryAddress && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-1">📍 Endereço</h2>
            <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
          </div>
        )}

        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-1">💳 Pagamento</h2>
          <p className="text-sm text-gray-700">
            {({
              cash: 'Dinheiro na entrega',
              credit: 'Cartão de crédito na entrega',
              debit: 'Cartão de débito na entrega',
              pix: 'Pix na entrega',
              online: 'Pagamento online',
            } as any)[order.paymentMethod] || order.paymentMethod}
          </p>
          {order.changeFor && (
            <p className="text-xs text-gray-500 mt-1">Troco para {formatBRL(order.changeFor)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverDistance({
  driverLat, driverLng, destLat, destLng, lastLocationAt,
}: {
  driverLat: number; driverLng: number;
  destLat: number | null; destLng: number | null;
  lastLocationAt: string | null;
}) {
  if (destLat == null || destLng == null) return null;
  const km = haversineKm(driverLat, driverLng, destLat, destLng);
  const when = lastLocationAt ? new Date(lastLocationAt) : null;
  const secondsAgo = when ? Math.round((Date.now() - when.getTime()) / 1000) : null;
  const stale = secondsAgo != null && secondsAgo > 120;
  const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${destLat},${destLng}`;
  return (
    <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
      <div className="flex items-center gap-2 text-orange-800">
        <MapPin className="w-4 h-4" />
        <span className="text-sm font-semibold">
          Motoboy a {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} de você
        </span>
      </div>
      {secondsAgo != null && (
        <div className={`text-[11px] mt-1 ${stale ? 'text-gray-500' : 'text-orange-700'}`}>
          {stale ? 'Localização antiga — atualizando...' : `Atualizado há ${secondsAgo < 60 ? `${secondsAgo}s` : `${Math.round(secondsAgo / 60)}min`}`}
        </div>
      )}
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-orange-700 underline"
      >
        Ver trajeto no mapa
      </a>
    </div>
  );
}
