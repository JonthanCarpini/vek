'use client';

import { useEffect, useState } from 'react';

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
      const res = await fetch('/api/v1/admin/delivery', { credentials: 'include' });
      const body = await res.json();
      if (res.ok) setConfig(body.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const update = (changes: any) => setConfig({ ...config, ...changes });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        slug: config.slug || undefined,
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

      const res = await fetch('/api/v1/admin/delivery', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setToast(body.error || 'Erro ao salvar');
      } else {
        setToast('✅ Configurações salvas');
        setNewApiKey('');
        load();
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (loading) return <div className="text-center text-gray-500 py-10">Carregando...</div>;
  if (!config) return <div>Erro ao carregar</div>;

  const publicUrl = config.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/delivery/${config.slug}`
    : null;

  return (
    <div className="space-y-6">
      {/* Status */}
      <section className="bg-white rounded-lg border p-5">
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
              <div className="text-xs text-gray-500">Clientes podem pedir para receber em casa</div>
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
              <div className="text-xs text-gray-500">Clientes podem pedir para retirar na loja</div>
            </div>
          </label>
        </div>
      </section>

      {/* URL pública */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-bold text-lg mb-4">URL Pública</h2>
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Slug (URL amigável)</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">/delivery/</span>
            <input
              type="text"
              value={config.slug || ''}
              onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="minha-loja"
              className="flex-1 px-3 py-2 border rounded-lg"
            />
          </div>
          {publicUrl && (
            <div className="mt-2 flex items-center gap-2">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-600 hover:underline break-all"
              >
                {publicUrl}
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(publicUrl); setToast('📋 URL copiada'); setTimeout(() => setToast(null), 2000); }}
                className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                Copiar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Localização */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-bold text-lg mb-4">Localização da loja</h2>
        <p className="text-xs text-gray-500 mb-3">
          Coordenadas de origem para calcular distância até o cliente.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Latitude</label>
            <input
              type="text"
              inputMode="decimal"
              value={config.addressLat ?? ''}
              onChange={(e) => update({ addressLat: e.target.value })}
              placeholder="-23.5505"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Longitude</label>
            <input
              type="text"
              inputMode="decimal"
              value={config.addressLng ?? ''}
              onChange={(e) => update({ addressLng: e.target.value })}
              placeholder="-46.6333"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
        <a
          href={`https://www.google.com/maps/search/${encodeURIComponent(config.address || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline mt-2 inline-block"
        >
          🗺️ Buscar coordenadas no Google Maps
        </a>
      </section>

      {/* Google Maps API */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-bold text-lg mb-4">Google Maps API</h2>
        <p className="text-xs text-gray-500 mb-3">
          Necessário para geocodificar endereços dos clientes.{' '}
          <a href="https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Obter chave →
          </a>
        </p>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${config.hasGoogleMapsKey ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {config.hasGoogleMapsKey ? '✓ Chave configurada' : '⚠️ Sem chave'}
          </div>
          {config.hasGoogleMapsKey && (
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-xs text-orange-600 hover:underline"
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
            className="w-full px-3 py-2 border rounded-lg mt-2 font-mono text-sm"
          />
        )}
      </section>

      {/* Taxa de entrega */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-bold text-lg mb-4">Taxa de entrega</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Taxa base (R$)</label>
            <input
              type="number"
              step="0.5" min="0"
              value={config.deliveryBaseFee}
              onChange={(e) => update({ deliveryBaseFee: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Por km (R$)</label>
            <input
              type="number"
              step="0.1" min="0"
              value={config.deliveryFeePerKm}
              onChange={(e) => update({ deliveryFeePerKm: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Raio máximo (km)</label>
            <input
              type="number"
              step="0.5" min="0.5" max="200"
              value={config.deliveryMaxRadiusKm}
              onChange={(e) => update({ deliveryMaxRadiusKm: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Pedido mínimo (R$)</label>
            <input
              type="number"
              step="1" min="0"
              value={config.deliveryMinOrder}
              onChange={(e) => update({ deliveryMinOrder: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-gray-600 mb-1 block">Frete grátis acima de R$ (opcional)</label>
            <input
              type="number"
              step="5" min="0"
              value={config.deliveryFreeOver ?? ''}
              onChange={(e) => update({ deliveryFreeOver: e.target.value || null })}
              placeholder="Deixe em branco para desabilitar"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* Tempos */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-bold text-lg mb-4">Tempos estimados</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Preparo (min)</label>
            <input
              type="number" min="1" max="240"
              value={config.deliveryPrepTimeMin}
              onChange={(e) => update({ deliveryPrepTimeMin: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Entrega média (min)</label>
            <input
              type="number" min="1" max="240"
              value={config.deliveryAvgTimeMin}
              onChange={(e) => update({ deliveryAvgTimeMin: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="sticky bottom-0 bg-white border-t p-4 -mx-4 md:-mx-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold px-6 py-2 rounded-lg"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
