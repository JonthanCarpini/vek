'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícones inline via DivIcon (evita paths absolutos que quebram no Next.js)
const driverIcon = new L.DivIcon({
  html: `<div style="background:#ea580c;border:3px solid white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:18px;">🛵</div>`,
  className: 'fleet-driver-marker',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const destIcon = new L.DivIcon({
  html: `<div style="background:#16a34a;border:3px solid white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:16px;">🏠</div>`,
  className: 'fleet-dest-marker',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const originIcon = new L.DivIcon({
  html: `<div style="background:#0ea5e9;border:3px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);font-size:20px;">🏪</div>`,
  className: 'fleet-origin-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export interface FleetOrder {
  id: string;
  sequenceNumber: number;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress?: string | null;
  dispatchedAt?: string | Date | null;
  estimatedDeliveryAt?: string | Date | null;
  driver: {
    id: string;
    name: string;
    phone?: string | null;
    currentLat: number;
    currentLng: number;
    lastLocationAt?: string | Date | null;
  };
}

export interface FleetMapProps {
  orders: FleetOrder[];
  origin?: { lat: number; lng: number; name?: string } | null;
  height?: number | string;
  onSelectOrder?: (orderId: string) => void;
}

/**
 * Mapa com todos os entregadores ativos, seus destinos e a origem da loja.
 * Auto-fit para enquadrar todos os pontos.
 */
export function FleetMap({ orders, origin, height = 500, onSelectOrder }: FleetMapProps) {
  // Fallback: centro é origem, ou primeiro motoboy, ou Brasil central
  const center = useMemo<[number, number]>(() => {
    if (origin) return [origin.lat, origin.lng];
    if (orders[0]) return [orders[0].driver.currentLat, orders[0].driver.currentLng];
    return [-14.235, -51.925];
  }, [origin, orders]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (origin) pts.push([origin.lat, origin.lng]);
    for (const o of orders) {
      pts.push([o.driver.currentLat, o.driver.currentLng]);
      pts.push([o.deliveryLat, o.deliveryLng]);
    }
    return pts;
  }, [origin, orders]);

  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)]"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{y}/{x}.png"
        />

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <strong>{origin.name || 'Loja'}</strong>
            </Popup>
          </Marker>
        )}

        {orders.map((o) => (
          <DriverDestPair key={o.id} order={o} onClick={onSelectOrder} />
        ))}

        <FitBounds points={allPoints} />
      </MapContainer>
    </div>
  );
}

function DriverDestPair({ order, onClick }: { order: FleetOrder; onClick?: (id: string) => void }) {
  return (
    <>
      <Marker position={[order.driver.currentLat, order.driver.currentLng]} icon={driverIcon}
        eventHandlers={onClick ? { click: () => onClick(order.id) } : undefined}
      >
        <Popup>
          <div className="text-sm">
            <div className="font-bold text-base">🛵 {order.driver.name}</div>
            <div className="text-xs text-gray-600 mt-1">Pedido #{order.sequenceNumber}</div>
            {order.customerName && <div className="text-xs text-gray-600">{order.customerName}</div>}
            {order.driver.phone && (
              <a href={`tel:${order.driver.phone}`} className="text-xs text-orange-600 hover:underline block mt-1">
                {order.driver.phone}
              </a>
            )}
          </div>
        </Popup>
      </Marker>
      <Marker position={[order.deliveryLat, order.deliveryLng]} icon={destIcon}
        eventHandlers={onClick ? { click: () => onClick(order.id) } : undefined}
      >
        <Popup>
          <div className="text-sm">
            <div className="font-bold text-base">🏠 Destino #{order.sequenceNumber}</div>
            {order.customerName && <div className="text-xs text-gray-700 mt-1">{order.customerName}</div>}
            {order.deliveryAddress && <div className="text-xs text-gray-600 mt-1">{order.deliveryAddress}</div>}
          </div>
        </Popup>
      </Marker>
      <Polyline
        positions={[
          [order.driver.currentLat, order.driver.currentLng],
          [order.deliveryLat, order.deliveryLng],
        ]}
        pathOptions={{ color: '#ea580c', weight: 3, dashArray: '6 6', opacity: 0.7 }}
      />
    </>
  );
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const prevRef = useRef<string>('');
  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map((p) => p.join(',')).join('|');
    if (key === prevRef.current) return;
    prevRef.current = key;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points as any);
    map.flyToBounds(bounds, { padding: [50, 50], duration: 0.8, maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default FleetMap;
