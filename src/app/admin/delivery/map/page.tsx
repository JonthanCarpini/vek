'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Bike, AlertCircle, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/staff-client';
import { getSocket } from '@/lib/socket-client';
import type { FleetOrder } from '@/components/FleetMap';

const FleetMap = dynamic(
  () => import('@/components/FleetMap').then((m) => m.FleetMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[60vh] rounded-xl bg-black/20 animate-pulse flex items-center justify-center text-gray-500 text-sm">
        Carregando mapa...
      </div>
    ),
  },
);

interface FleetResponse {
  origin: { lat: number; lng: number; name: string } | null;
  orders: FleetOrder[];
}

export default function AdminDeliveryMapPage() {
  const [data, setData] = useState<FleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res: FleetResponse = await apiFetch('/api/v1/admin/delivery/fleet');
      setData(res);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar dados da frota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const socket = getSocket();

    // Atualização de posição: patch in-place
    const onDriverLocation = (p: any) => {
      if (!p?.driverId) return;
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.orders.map((o) =>
          o.driver.id === p.driverId
            ? { ...o, driver: { ...o.driver, currentLat: p.lat, currentLng: p.lng, lastLocationAt: p.at } }
            : o,
        );
        return { ...prev, orders: updated };
      });
    };
    // Mudança de status: reload (pedido pode ter sido entregue e sair do mapa)
    const onOrderChanged = () => load();

    socket.on('driver.location', onDriverLocation);
    socket.on('order.status_changed', onOrderChanged);
    socket.on('order.updated', onOrderChanged);

    // Polling de fallback a cada 30s
    const timer = setInterval(load, 30_000);

    return () => {
      socket.off('driver.location', onDriverLocation);
      socket.off('order.status_changed', onOrderChanged);
      socket.off('order.updated', onOrderChanged);
      clearInterval(timer);
    };
  }, []);

  const selectedOrder = useMemo(
    () => data?.orders.find((o) => o.id === selectedId) || null,
    [data, selectedId],
  );

  // Agrupa por motoboy (um mesmo motoboy pode ter várias entregas)
  const driverCount = useMemo(() => {
    if (!data) return 0;
    return new Set(data.orders.map((o) => o.driver.id)).size;
  }, [data]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Mapa ao vivo</h1>
            <p className="text-sm text-gray-400">
              {data ? (
                <>
                  <span className="text-orange-400 font-semibold">{data.orders.length}</span> entrega(s) em andamento
                  {driverCount > 0 && (
                    <> com <span className="text-orange-400 font-semibold">{driverCount}</span> motoboy(s) ativo(s)</>
                  )}
                </>
              ) : 'Carregando...'}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="btn btn-secondary text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </header>

      {loading && !data ? (
        <div className="h-[60vh] rounded-xl bg-black/20 animate-pulse" />
      ) : error ? (
        <div className="card p-6 border border-red-500/30 bg-red-500/5 text-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Erro ao carregar mapa</p>
              <p className="text-sm text-red-300/80 mt-1">{error}</p>
              <button onClick={load} className="mt-2 text-sm underline text-red-200">
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      ) : !data?.origin ? (
        <div className="card p-6 border border-amber-500/30 bg-amber-500/5 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Endereço da loja não configurado</p>
              <p className="text-sm text-amber-300/80 mt-1">
                Cadastre as coordenadas da loja em{' '}
                <Link href="/admin/delivery" className="underline text-amber-200">
                  /admin/delivery
                </Link>{' '}
                para exibir o mapa ao vivo.
              </p>
            </div>
          </div>
        </div>
      ) : data.orders.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Bike className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium text-gray-300">Nenhuma entrega em andamento</p>
          <p className="text-sm mt-1">
            Quando um motoboy sair para entrega, ele aparece aqui em tempo real.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <FleetMap
            orders={data.orders}
            origin={data.origin}
            height="70vh"
            onSelectOrder={setSelectedId}
          />

          {/* Lista lateral */}
          <aside className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
            {data.orders.map((o) => {
              const active = selectedId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedId(active ? null : o.id)}
                  className={`w-full text-left card p-3 border transition ${
                    active
                      ? 'border-orange-500 ring-2 ring-orange-500/30'
                      : 'border-[var(--border)] hover:border-orange-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-orange-400">#{o.sequenceNumber}</span>
                    <span className="text-sm text-gray-300 truncate flex-1">{o.customerName || 'Cliente'}</span>
                    <StalenessBadge lastLocationAt={o.driver.lastLocationAt} />
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Bike className="w-3 h-3" /> {o.driver.name}
                  </div>
                  {o.deliveryAddress && (
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{o.deliveryAddress}</div>
                  )}
                  {o.estimatedDeliveryAt && (
                    <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Previsão:{' '}
                      {new Date(o.estimatedDeliveryAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </aside>
        </div>
      )}

      {/* Info do pedido selecionado (mobile: painel inferior) */}
      {selectedOrder && (
        <div className="card p-4 border border-orange-500/30 space-y-1 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="font-bold">Pedido #{selectedOrder.sequenceNumber}</div>
            <button onClick={() => setSelectedId(null)} className="text-xs text-gray-400">
              fechar
            </button>
          </div>
          <div className="text-sm text-gray-300">{selectedOrder.customerName}</div>
          <div className="text-xs text-gray-500">{selectedOrder.deliveryAddress}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1 pt-1">
            <Bike className="w-3 h-3" /> {selectedOrder.driver.name}
            {selectedOrder.driver.phone && (
              <>
                <span className="mx-1">·</span>
                <a href={`tel:${selectedOrder.driver.phone}`} className="text-orange-400 hover:underline">
                  {selectedOrder.driver.phone}
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StalenessBadge({ lastLocationAt }: { lastLocationAt: string | Date | null | undefined }) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(i);
  }, []);
  if (!lastLocationAt) return null;
  const secondsAgo = Math.round((Date.now() - new Date(lastLocationAt).getTime()) / 1000);
  const stale = secondsAgo > 120;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
        stale
          ? 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-gray-400' : 'bg-emerald-400 animate-pulse'}`} />
      {stale ? 'sem sinal' : 'ao vivo'}
    </span>
  );
}
