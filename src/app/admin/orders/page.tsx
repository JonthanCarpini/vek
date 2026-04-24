'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { apiFetch } from '@/lib/staff-client';
import { getSocket } from '@/lib/socket-client';
import {
  RefreshCw, Search, ChevronDown, ChevronUp, MapPin, User, Phone,
  Bike, ShoppingBag, UtensilsCrossed, ExternalLink, Truck, Map as MapIcon,
} from 'lucide-react';

// Leaflet só no cliente — evita `window is not defined` no SSR
const LiveDeliveryMap = dynamic(
  () => import('@/components/LiveDeliveryMap').then((m) => m.LiveDeliveryMap),
  { ssr: false, loading: () => <div className="h-[240px] rounded-xl bg-black/20 animate-pulse" /> },
);

// Dicionário de status — inclui transições de delivery (dispatched).
const STATUS_LABELS: Record<string, { label: string; dot: string; chip: string }> = {
  received:   { label: 'Recebido',      dot: 'bg-sky-500',     chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  accepted:   { label: 'Confirmado',    dot: 'bg-indigo-500',  chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  preparing:  { label: 'Em preparo',    dot: 'bg-amber-500',   chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  ready:      { label: 'Pronto',        dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  dispatched: { label: 'Saiu p/ entrega', dot: 'bg-purple-500', chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  delivered:  { label: 'Entregue',      dot: 'bg-gray-500',    chip: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
  cancelled:  { label: 'Cancelado',     dot: 'bg-red-500',     chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

// Próximo status na esteira — respeita o canal (delivery termina em dispatched→delivered, dine-in em ready→delivered).
const NEXT_STATUS_DINEIN: Record<string, string | null> = {
  received: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};
const NEXT_STATUS_DELIVERY: Record<string, string | null> = {
  received: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'dispatched',
  dispatched: 'delivered',
};
const NEXT_STATUS_TAKEOUT: Record<string, string | null> = {
  received: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

type Channel = 'dine-in' | 'delivery' | 'ifood';

interface ChannelMeta {
  label: string;
  icon: typeof UtensilsCrossed;
  chip: string;
}
const CHANNEL_META: Record<Channel, ChannelMeta> = {
  'dine-in':  { label: 'Mesa',     icon: UtensilsCrossed, chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  delivery:   { label: 'Delivery', icon: Bike,            chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  ifood:      { label: 'iFood',    chip: 'bg-red-500/15 text-red-300 border-red-500/30', icon: ShoppingBag },
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Opções do filtro de status — agrupa "em andamento" como sentinela especial.
const STATUS_FILTERS = [
  { value: 'active',     label: 'Em andamento' },
  { value: 'received',   label: 'Recebidos' },
  { value: 'accepted',   label: 'Confirmados' },
  { value: 'preparing',  label: 'Em preparo' },
  { value: 'ready',      label: 'Prontos' },
  { value: 'dispatched', label: 'Saíram' },
  { value: 'delivered',  label: 'Entregues' },
  { value: 'all',        label: 'Todos' },
] as const;
type StatusFilter = typeof STATUS_FILTERS[number]['value'];

const ACTIVE_STATUSES = ['received', 'accepted', 'preparing', 'ready', 'dispatched'];

// Lê/escreve filtros na URL para persistir entre refreshes
function readUrlFilters() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return {
    status: p.get('status') as StatusFilter || 'active',
    channel: p.get('channel') as 'all' | Channel || 'all',
    q: p.get('q') || '',
    from: p.get('from') || '',
    to: p.get('to') || '',
  };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);

  // Restore filters from URL on mount
  useEffect(() => {
    const f = readUrlFilters();
    setStatusFilter((f.status ?? 'active') as StatusFilter);
    setChannelFilter((f.channel ?? 'all') as 'all' | Channel);
    setSearch(f.q ?? '');
    setDateFrom(f.from ?? '');
    setDateTo(f.to ?? '');
    setUrlReady(true);
  }, []);

  // Persist filters to URL on change
  useEffect(() => {
    if (!urlReady) return;
    const p = new URLSearchParams();
    if (statusFilter !== 'active') p.set('status', statusFilter);
    if (channelFilter !== 'all') p.set('channel', channelFilter);
    if (search) p.set('q', search);
    if (dateFrom) p.set('from', dateFrom);
    if (dateTo) p.set('to', dateTo);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `/admin/orders?${qs}` : '/admin/orders');
  }, [statusFilter, channelFilter, search, dateFrom, dateTo, urlReady]);

  const load = async () => {
    try {
      const qsStatus = statusFilter === 'active' ? 'all' : statusFilter;
      const qs = new URLSearchParams({ status: qsStatus, channel: channelFilter, limit: '300' });
      if (dateFrom) qs.set('from', dateFrom);
      if (dateTo) qs.set('to', dateTo);
      const data = await apiFetch(`/api/v1/admin/orders?${qs}`);
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      const data = await apiFetch('/api/v1/admin/drivers?active=true');
      setDrivers(data?.drivers || []);
    } catch {}
  };

  useEffect(() => {
    if (!urlReady) return;
    setLoading(true);
    load();
  }, [statusFilter, channelFilter, dateFrom, dateTo, urlReady]);

  useEffect(() => {
    loadDrivers();
    // Socket — reage a novos pedidos e mudanças de status
    const socket = getSocket();
    const refresh = () => load();
    // Atualização patch do lat/lng do motoboy sem full reload (vem em order:{id} E dashboard)
    const onDriverLocation = (p: any) => {
      if (!p?.driverId) return;
      setOrders((prev) => prev.map((o) => {
        if (o.driver?.id !== p.driverId) return o;
        return {
          ...o,
          driver: { ...o.driver, currentLat: p.lat, currentLng: p.lng, lastLocationAt: p.at },
        };
      }));
    };
    socket.on('order.created', refresh);
    socket.on('order.updated', refresh);
    socket.on('order.status_changed', refresh);
    socket.on('driver.location', onDriverLocation);
    const timer = setInterval(load, 20_000);
    return () => {
      socket.off('order.created', refresh);
      socket.off('order.updated', refresh);
      socket.off('order.status_changed', refresh);
      socket.off('driver.location', onDriverLocation);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter === 'active') {
      list = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) =>
        String(o.sequenceNumber).includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  // Contadores por canal (antes de aplicar filtro de status) para os chips topo
  const channelCounts = useMemo(() => {
    const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    return {
      all: active.length,
      'dine-in': active.filter((o) => o.channel === 'dine-in').length,
      delivery: active.filter((o) => o.channel === 'delivery').length,
      ifood: active.filter((o) => o.channel === 'ifood').length,
    };
  }, [orders]);

  const advanceStatus = async (order: any, nextStatus: string) => {
    try {
      if (order.channel === 'delivery' || order.channel === 'ifood') {
        // Delivery usa o endpoint dedicado que dispara push/WhatsApp
        await apiFetch(`/api/v1/admin/delivery/orders/${order.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus }),
        });
      } else {
        await apiFetch(`/api/v1/kitchen/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
      }
      load();
    } catch (e: any) {
      alert(e.message || 'Falha ao atualizar status');
    }
  };

  const cancelOrder = async (order: any) => {
    const reason = prompt('Motivo do cancelamento?');
    if (reason === null) return;
    try {
      if (order.channel === 'delivery' || order.channel === 'ifood') {
        await apiFetch(`/api/v1/admin/delivery/orders/${order.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'cancelled', reason }),
        });
      } else {
        await apiFetch(`/api/v1/kitchen/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'cancelled' }),
        });
      }
      load();
    } catch (e: any) {
      alert(e.message || 'Falha ao cancelar');
    }
  };

  const assignDriver = async (order: any, driverId: string | null) => {
    try {
      await apiFetch(`/api/v1/admin/delivery/orders/${order.id}/assign-driver`, {
        method: 'POST',
        body: JSON.stringify({ driverId }),
      });
      load();
    } catch (e: any) {
      alert(e.message || 'Falha ao atribuir motoboy');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-gray-400">
            Acompanhe e gerencie todos os pedidos (mesa, delivery, iFood)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/delivery/map"
            className="btn btn-secondary text-sm flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" /> Mapa ao vivo
          </Link>
          <button
            onClick={load}
            className="btn btn-secondary text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </header>

      {/* Chips de canal + busca + data */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChannelChip active={channelFilter === 'all'} onClick={() => setChannelFilter('all')} label="Todos" count={channelCounts.all} />
        <ChannelChip active={channelFilter === 'dine-in'} onClick={() => setChannelFilter('dine-in')} label="Mesa" Icon={UtensilsCrossed} count={channelCounts['dine-in']} />
        <ChannelChip active={channelFilter === 'delivery'} onClick={() => setChannelFilter('delivery')} label="Delivery" Icon={Bike} count={channelCounts.delivery} />
        <ChannelChip active={channelFilter === 'ifood'} onClick={() => setChannelFilter('ifood')} label="iFood" Icon={ShoppingBag} count={channelCounts.ifood} />
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {/* Filtro de data */}
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <span className="text-xs">De</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="input text-sm py-1.5 px-2 w-36 [color-scheme:dark]" />
            <span className="text-xs">Até</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="input text-sm py-1.5 px-2 w-36 [color-scheme:dark]" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-500 hover:text-gray-300">✕</button>
            )}
          </div>
          {/* Busca */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="# nome, telefone, endereço" className="input pl-9 w-56" />
          </div>
        </div>
      </div>

      {/* Filtro de status — dropdown horizontal */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-no-tab-swipe>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-full border transition ${
              statusFilter === f.value
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-[var(--card)] border-[var(--border)] text-gray-300 hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Carregando...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          Nenhum pedido encontrado
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              drivers={drivers}
              onAdvance={advanceStatus}
              onCancel={cancelOrder}
              onAssignDriver={assignDriver}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== SUBCOMPONENTES ==========

function ChannelChip({
  active, onClick, label, count, Icon,
}: {
  active: boolean; onClick: () => void; label: string; count?: number;
  Icon?: typeof UtensilsCrossed;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition ${
        active
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'bg-[var(--card)] border-[var(--border)] text-gray-300 hover:bg-white/5'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
      {count != null && count > 0 && (
        <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20' : 'bg-white/10'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function OrderCard({
  order: o, expanded, onToggle, drivers, onAdvance, onCancel, onAssignDriver,
}: {
  order: any;
  expanded: boolean;
  onToggle: () => void;
  drivers: any[];
  onAdvance: (o: any, next: string) => void;
  onCancel: (o: any) => void;
  onAssignDriver: (o: any, driverId: string | null) => void;
}) {
  // Fallback defensivo: pedidos legados podem não ter `channel` ou vir com
  // valor inesperado; sem isto o `meta.icon` quebra a render completa.
  const rawChannel = (o.channel || 'dine-in') as string;
  const channel = (CHANNEL_META[rawChannel as Channel] ? rawChannel : 'dine-in') as Channel;
  const meta = CHANNEL_META[channel];
  const ChannelIcon = meta.icon;
  const statusInfo = STATUS_LABELS[o.status] || { label: o.status, dot: 'bg-gray-500', chip: 'bg-gray-500/15 text-gray-300 border-gray-500/30' };
  const isTakeout = o.orderType === 'takeout';
  const isDelivery = o.orderType === 'delivery' && channel !== 'dine-in';

  const nextMap = channel === 'dine-in'
    ? NEXT_STATUS_DINEIN
    : isTakeout ? NEXT_STATUS_TAKEOUT : NEXT_STATUS_DELIVERY;
  const next = nextMap[o.status];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {/* Linha 1: número + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">#{o.sequenceNumber}</span>

              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${meta.chip}`}>
                <ChannelIcon className="w-3 h-3" />
                {meta.label}
                {channel !== 'dine-in' && o.orderType && (
                  <span className="opacity-70">· {isTakeout ? 'Retirada' : 'Entrega'}</span>
                )}
              </span>

              <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${statusInfo.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>

              {o.paymentStatus === 'paid' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 border border-green-500/30">
                  Pago
                </span>
              )}

              {channel === 'dine-in' && o.table?.number && !o.table?.virtual && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-[var(--border)]">
                  Mesa {o.table.number}
                </span>
              )}
            </div>

            {/* Linha 2: cliente/endereço */}
            <div className="mt-2 space-y-0.5 text-sm">
              {o.customerName && (
                <div className="flex items-center gap-1.5 text-gray-300">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span>{o.customerName}</span>
                  {o.customerPhone && (
                    <span className="text-gray-500">· {o.customerPhone}</span>
                  )}
                </div>
              )}
              {isDelivery && o.deliveryAddress && (
                <div className="flex items-start gap-1.5 text-gray-400 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <span className="truncate">{o.deliveryAddress}</span>
                  {o.distanceKm != null && (
                    <span className="text-gray-500 flex-shrink-0">· {o.distanceKm}km</span>
                  )}
                </div>
              )}
              {isDelivery && o.driver && (
                <div className="flex items-center gap-1.5 text-purple-300 text-xs">
                  <Bike className="w-3.5 h-3.5" />
                  <span>{o.driver.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Total + hora */}
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-orange-400 text-lg">{formatBRL(o.total)}</div>
            <div className="text-xs text-gray-500">{formatTime(o.createdAt)}</div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1 justify-end">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'ocultar' : 'detalhes'}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[var(--border)] bg-black/20 p-4 space-y-4">
          {/* Itens */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Itens</h4>
            <div className="space-y-1 text-sm">
              {o.items.map((i: any) => (
                <div key={i.id} className="flex justify-between gap-3">
                  <span className="text-gray-200">
                    <span className="text-gray-500">{i.quantity}×</span> {i.name}
                    {i.notes && <span className="block text-xs text-gray-500 italic">{i.notes}</span>}
                  </span>
                  <span className="text-gray-300 flex-shrink-0">{formatBRL(i.totalPrice)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-[var(--border)] text-sm space-y-0.5">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{formatBRL(o.subtotal)}</span>
              </div>
              {o.deliveryFee > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Taxa de entrega{o.distanceKm ? ` (${o.distanceKm}km)` : ''}</span>
                  <span>{formatBRL(o.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-orange-400">
                <span>Total</span>
                <span>{formatBRL(o.total)}</span>
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {o.paymentMethod && (
              <InfoBlock label="Pagamento">
                {o.paymentMethod}
                {o.changeFor ? ` (troco para ${formatBRL(o.changeFor)})` : ''}
                {o.paymentStatus && (
                  <span className="ml-1 text-xs text-gray-500">({o.paymentStatus})</span>
                )}
              </InfoBlock>
            )}
            {isDelivery && o.deliveryAddress && (
              <InfoBlock label="Endereço completo">
                <span className="text-gray-200">{o.deliveryAddress}</span>
                {o.deliveryLat != null && o.deliveryLng != null && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${o.deliveryLat},${o.deliveryLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 ml-2 text-orange-400 hover:underline text-xs"
                  >
                    <ExternalLink className="w-3 h-3" /> Maps
                  </a>
                )}
              </InfoBlock>
            )}
            {o.customerPhone && (
              <InfoBlock label="Telefone">
                <a href={`tel:${o.customerPhone}`} className="text-gray-200 hover:text-orange-400">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {o.customerPhone}
                </a>
                <a
                  href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-emerald-400 hover:underline text-xs"
                >
                  WhatsApp
                </a>
              </InfoBlock>
            )}
            {o.notes && (
              <InfoBlock label="Observações">
                {o.notes}
              </InfoBlock>
            )}
          </div>

          {/* Mapa ao vivo — motoboy a caminho */}
          {isDelivery && o.status === 'dispatched' && o.driver?.currentLat != null && o.driver?.currentLng != null
            && o.deliveryLat != null && o.deliveryLng != null && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                <MapIcon className="w-3.5 h-3.5" /> Trajeto ao vivo
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full ml-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  AO VIVO
                </span>
              </h4>
              <LiveDeliveryMap
                driverLat={o.driver.currentLat}
                driverLng={o.driver.currentLng}
                destLat={o.deliveryLat}
                destLng={o.deliveryLng}
                height={260}
              />
              <DriverLocationStatus lastLocationAt={o.driver.lastLocationAt} />
            </div>
          )}

          {/* Atribuição de motoboy (somente pedidos de entrega) */}
          {isDelivery && ['accepted', 'preparing', 'ready', 'dispatched'].includes(o.status) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Entregador
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={o.driver?.id || ''}
                  onChange={(e) => onAssignDriver(o, e.target.value || null)}
                  className="input text-sm flex-1 sm:flex-initial sm:min-w-[200px]"
                >
                  <option value="">— Não atribuído —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {o.driver?.phone && (
                  <a
                    href={`tel:${o.driver.phone}`}
                    className="text-sm text-gray-400 hover:text-orange-400 flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" /> {o.driver.phone}
                  </a>
                )}
              </div>
              {drivers.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Nenhum motoboy cadastrado. Cadastre em <a href="/admin/drivers" className="text-orange-400 hover:underline">Motoboys</a>.
                </p>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 flex-wrap pt-3 border-t border-[var(--border)]">
            {next && o.status !== 'cancelled' && (
              <button
                onClick={() => onAdvance(o, next)}
                className="btn btn-primary text-sm py-1.5 px-3"
                style={{ minHeight: 'auto' }}
              >
                → {STATUS_LABELS[next].label}
              </button>
            )}
            {o.status !== 'cancelled' && o.status !== 'delivered' && (
              <button
                onClick={() => onCancel(o)}
                className="bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 px-3 py-1.5 text-sm rounded-lg"
              >
                Cancelar
              </button>
            )}
            {(channel === 'delivery' || channel === 'ifood') && (
              <a
                href={`/t/${o.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[var(--card)] border border-[var(--border)] text-gray-300 hover:bg-white/5 px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Tracking público
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-0.5">{label}</h4>
      <div className="text-gray-200 text-sm">{children}</div>
    </div>
  );
}

function DriverLocationStatus({ lastLocationAt }: { lastLocationAt: string | Date | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(i);
  }, []);
  if (!lastLocationAt) return null;
  const secondsAgo = Math.round((Date.now() - new Date(lastLocationAt).getTime()) / 1000);
  const stale = secondsAgo > 120;
  return (
    <div className={`text-[11px] mt-2 ${stale ? 'text-gray-500' : 'text-emerald-400'}`}>
      {stale
        ? '⚠️ Localização antiga — pode ser que o motoboy perdeu conexão'
        : `Atualizado há ${secondsAgo < 60 ? `${secondsAgo}s` : `${Math.round(secondsAgo / 60)}min`}`}
    </div>
  );
}
