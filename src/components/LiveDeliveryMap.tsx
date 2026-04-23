'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet por padrão tenta carregar assets dos ícones via CDN com paths absolutos
// que quebram no Next.js. Sobrescrevemos com SVGs embutidos via data URI.
// Ref: https://github.com/Leaflet/Leaflet/issues/4968
const driverIcon = new L.DivIcon({
  html: `
    <div style="
      background: #ea580c;
      border: 3px solid white;
      border-radius: 50%;
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: 20px;
    ">🛵</div>
  `,
  className: 'driver-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const destIcon = new L.DivIcon({
  html: `
    <div style="
      background: #16a34a;
      border: 3px solid white;
      border-radius: 50%;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: 18px;
    ">🏠</div>
  `,
  className: 'dest-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export interface LiveDeliveryMapProps {
  driverLat: number;
  driverLng: number;
  destLat: number;
  destLng: number;
  /** Altura do mapa em px. Default 300. */
  height?: number;
}

/**
 * Mapa ao vivo com pin do motoboy e do destino, auto-fit para mostrar os dois.
 * Reage a mudanças de driverLat/driverLng movendo o pin e recentrando.
 */
export function LiveDeliveryMap({
  driverLat, driverLng, destLat, destLng, height = 300,
}: LiveDeliveryMapProps) {
  const center = useMemo<[number, number]>(
    () => [(driverLat + destLat) / 2, (driverLng + destLng) / 2],
    [], // centro inicial apenas; depois quem centraliza é o FitBounds
  );

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[driverLat, driverLng]} icon={driverIcon}>
          <Popup>Seu entregador</Popup>
        </Marker>
        <Marker position={[destLat, destLng]} icon={destIcon}>
          <Popup>Entrega aqui</Popup>
        </Marker>
        <Polyline
          positions={[[driverLat, driverLng], [destLat, destLng]]}
          pathOptions={{ color: '#ea580c', weight: 3, dashArray: '6 6', opacity: 0.7 }}
        />
        <FitBounds points={[[driverLat, driverLng], [destLat, destLng]]} />
      </MapContainer>
    </div>
  );
}

/**
 * Ajusta o bounding-box para sempre mostrar motoboy e destino com pequena margem.
 * Re-executa quando o array `points` muda de referência.
 */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const prevRef = useRef<string>('');
  useEffect(() => {
    const key = points.map((p) => p.join(',')).join('|');
    if (key === prevRef.current) return;
    prevRef.current = key;
    const bounds = L.latLngBounds(points as any);
    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8, maxZoom: 16 });
  }, [points, map]);
  return null;
}

export default LiveDeliveryMap;
