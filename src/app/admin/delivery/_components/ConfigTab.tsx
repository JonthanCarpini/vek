'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import PushConfigCard from './PushConfigCard';

export default function ConfigTab() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/v1/admin/delivery');
      setConfig(data);
    } catch (e: any) {
      setToast(e.message || 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const update = (changes: any) => setConfig({ ...config, ...changes });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        deliveryEnabled: config.deliveryEnabled,
        takeoutEnabled: config.takeoutEnabled,
        deliveryMinOrder: Number(config.deliveryMinOrder),
        deliveryMaxRadiusKm: Number(config.deliveryMaxRadiusKm),
        deliveryBaseFee: Number(config.deliveryBaseFee),
        deliveryFeePerKm: Number(config.deliveryFeePerKm),
        deliveryFreeOver: config.deliveryFreeOver ? Number(config.deliveryFreeOver) : null,
        deliveryPrepTimeMin: Number(config.deliveryPrepTimeMin),
        deliveryAvgTimeMin: Number(config.deliveryAvgTimeMin),
        addressLat: config.addressLat ? Number(config.addressLat) : null,
        addressLng: config.addressLng ? Number(config.addressLng) : null,
      };
      if (newApiKey) payload.googleMapsApiKey = newApiKey;

      await apiFetch('/api/v1/admin/delivery', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setToast('✅ Configurações salvas');
      setNewApiKey('');
      load();
    } catch (e: any) {
      setToast(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-10">Carregando...</div>;
  if (!config) return <div className="text-red-400">Erro ao carregar</div>;

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/delivery` : '/delivery';

  return (
    <div className="space-y-6">
      {/* Status */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-4">Ativação</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.deliveryEnabled}
              onChange={(e) => update({ deliveryEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Entrega em domicílio</div>
              <div className="text-xs text-gray-400">Clientes podem pedir para receber em casa</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.takeoutEnabled}
              onChange={(e) => update({ takeoutEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Retirada no balcão</div>
              <div className="text-xs text-gray-400">Clientes podem pedir para retirar na loja</div>
            </div>
          </label>
        </div>
      </section>

      {/* URL pública */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-4">URL Pública</h2>
        <div className="flex items-center gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-orange-400 hover:underline break-all"
          >
            {publicUrl}
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText(publicUrl); setToast('📋 URL copiada'); setTimeout(() => setToast(null), 2000); }}
            className="text-xs px-2 py-1 bg-gray-800 text-gray-200 rounded hover:bg-gray-700"
          >
            Copiar
          </button>
        </div>
      </section>

      {/* Localização */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-4">Localização da loja</h2>
        <p className="text-xs text-gray-400 mb-3">
          Coordenadas de origem para calcular distância até o cliente.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Latitude</label>
            <input
              type="text"
              inputMode="decimal"
              value={config.addressLat ?? ''}
              onChange={(e) => update({ addressLat: e.target.value })}
              placeholder="-23.5505"
              className="w-full input"
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              type="text"
              inputMode="decimal"
              value={config.addressLng ?? ''}
              onChange={(e) => update({ addressLng: e.target.value })}
              placeholder="-46.6333"
              className="w-full input"
            />
          </div>
        </div>
        <a
          href={`https://www.google.com/maps/search/${encodeURIComponent(config.address || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline mt-2 inline-block"
        >
          🗺️ Buscar coordenadas no Google Maps
        </a>
      </section>

      {/* Google Maps API */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-4">Google Maps API</h2>
        <p className="text-xs text-gray-400 mb-3">
          Necessário para geocodificar endereços dos clientes.{' '}
          <a href="https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Obter chave →
          </a>
        </p>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${config.hasGoogleMapsKey ? 'bg-green-600/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
            {config.hasGoogleMapsKey ? '✓ Chave configurada' : '⚠️ Sem chave'}
          </div>
          {config.hasGoogleMapsKey && (
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-xs text-orange-400 hover:underline"
            >
              {showApiKey ? 'Cancelar' : 'Substituir chave'}
            </button>
          )}
        </div>
        {(showApiKey || !config.hasGoogleMapsKey) && (
          <input
            type="text"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full input mt-2 font-mono text-sm"
          />
        )}
      </section>

      {/* Taxa de entrega */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-4">Taxa de entrega</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Taxa base (R$)</label>
            <input
              type="number"
              step="0.5" min="0"
              value={config.deliveryBaseFee}
              onChange={(e) => update({ deliveryBaseFee: e.target.value })}
              className="w-full input"
            />
          </div>
          <div>
            <label className="label">Por km (R$)</label>
            <input
              type="number"
              step="0.1" min="0"
              value={config.deliveryFeePerKm}
              onChange={(e) => update({ deliveryFeePerKm: e.target.value })}
              className="w-full input"
            />
          </div>
          <div>
            <label className="label">Raio máximo (km)</label>
            <input
              type="number"
              step="0.5" min="0.5" max="200"
              value={config.deliveryMaxRadiusKm}
              onChange={(e) => update({ deliveryMaxRadiusKm: e.target.value })}
              className="w-full input"
            />
          </div>
          <div>
            <label className="label">Pedido mínimo (R$)</label>
            <input
              type="number"
              step="1" min="0"
              value={config.deliveryMinOrder}
              onChange={(e) => update({ deliveryMinOrder: e.target.value })}
              className="w-full input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Frete grátis acima de R$ (opcional)</label>
            <input
              type="number"
              step="5" min="0"
              value={config.deliveryFreeOver ?? ''}
              onChange={(e) => update({ deliveryFreeOver: e.target.value || null })}
              placeholder="Deixe em branco para desabilitar"
              className="w-full input"
            />
          </div>
        </div>
      </section>

      {/* Tempos */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-4">Tempos estimados</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Preparo (min)</label>
            <input
              type="number" min="1" max="240"
              value={config.deliveryPrepTimeMin}
              onChange={(e) => update({ deliveryPrepTimeMin: e.target.value })}
              className="w-full input"
            />
          </div>
          <div>
            <label className="label">Entrega média (min)</label>
            <input
              type="number" min="1" max="240"
              value={config.deliveryAvgTimeMin}
              onChange={(e) => update({ deliveryAvgTimeMin: e.target.value })}
              className="w-full input"
            />
          </div>
        </div>
      </section>

      {/* Push (Web Push / VAPID) */}
      <PushConfigCard />

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="sticky bottom-0 bg-[var(--bg)] border-t border-gray-800 p-4 -mx-4 md:-mx-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
