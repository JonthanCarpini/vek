'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Plus, Trash2, Check } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { deliveryApi, maskCEP } from '../_lib/api';

export default function AddressStep() {
  const { goTo, setSelectedAddressId, selectedAddressId } = useDelivery();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadAddresses = async () => {
    setLoading(true);
    const res = await deliveryApi.listAddresses();
    if (res.ok) {
      setAddresses(res.data.addresses);
      if (res.data.addresses.length === 0) setShowForm(true);
    }
    setLoading(false);
  };

  useEffect(() => { loadAddresses(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este endereço?')) return;
    await deliveryApi.deleteAddress(id);
    if (selectedAddressId === id) setSelectedAddressId(null);
    loadAddresses();
  };

  const handleSelect = (id: string) => {
    setSelectedAddressId(id);
    goTo('checkout');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={() => goTo('menu')} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Endereço de entrega</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando...</div>
        ) : showForm ? (
          <AddressForm
            onCancel={() => setShowForm(false)}
            onSaved={(id) => {
              setShowForm(false);
              setSelectedAddressId(id);
              loadAddresses();
              goTo('checkout');
            }}
            hasOthers={addresses.length > 0}
          />
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition ${
                    selectedAddressId === a.id ? 'border-orange-500' : 'border-transparent'
                  }`}
                  onClick={() => handleSelect(a.id)}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{a.label}</span>
                        {selectedAddressId === a.id && <Check className="w-4 h-4 text-orange-500" />}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        {a.street}, {a.number}
                        {a.complement && ` - ${a.complement}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {a.neighborhood}, {a.city}/{a.state}
                        {a.zipCode && ` - ${a.zipCode}`}
                      </p>
                      {!a.lat && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ Sem coordenadas. Recadastre para calcular frete.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-600 hover:border-orange-500 hover:text-orange-500 transition"
            >
              <Plus className="w-5 h-5" /> Cadastrar novo endereço
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddressForm({
  onCancel, onSaved, hasOthers,
}: { onCancel: () => void; onSaved: (id: string) => void; hasOthers: boolean }) {
  const [form, setForm] = useState({
    label: 'Casa', zipCode: '', street: '', number: '', complement: '',
    reference: '', neighborhood: '', city: '', state: '',
  });
  const [isDefault, setIsDefault] = useState(!hasOthers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCepBlur = async () => {
    const clean = form.zipCode.replace(/\D/g, '');
    if (clean.length !== 8) return;
    const res = await deliveryApi.lookupZip(clean);
    if (res.ok) {
      setForm((f) => ({
        ...f,
        street: res.data.street || f.street,
        neighborhood: res.data.neighborhood || f.neighborhood,
        city: res.data.city || f.city,
        state: res.data.state || f.state,
      }));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    // Validações mínimas
    if (!form.street || !form.number || !form.neighborhood || !form.city) {
      setError('Preencha rua, número, bairro e cidade');
      return;
    }
    setLoading(true);
    const res = await deliveryApi.createAddress({ ...form, isDefault });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (!res.data.lat || !res.data.lng) {
      setError('Não conseguimos encontrar esse endereço no mapa. Verifique os dados.');
      return;
    }
    onSaved(res.data.id);
  };

  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-lg">Novo endereço</h2>

      <div>
        <label className="text-sm text-gray-600 mb-1 block">Apelido</label>
        <select
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option>Casa</option>
          <option>Trabalho</option>
          <option>Outro</option>
        </select>
      </div>

      <div>
        <label className="text-sm text-gray-600 mb-1 block">CEP</label>
        <input
          type="text"
          inputMode="numeric"
          value={form.zipCode}
          onChange={(e) => setForm({ ...form, zipCode: maskCEP(e.target.value) })}
          onBlur={handleCepBlur}
          placeholder="00000-000"
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-[1fr,100px] gap-2">
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Rua</label>
          <input
            type="text"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Número</label>
          <input
            type="text"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-600 mb-1 block">Complemento (opcional)</label>
        <input
          type="text"
          value={form.complement}
          onChange={(e) => setForm({ ...form, complement: e.target.value })}
          placeholder="Apto 12, Bloco B..."
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="text-sm text-gray-600 mb-1 block">Ponto de referência (opcional)</label>
        <input
          type="text"
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
          placeholder="Próximo ao mercado..."
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Bairro</label>
          <input
            type="text"
            value={form.neighborhood}
            onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Cidade</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-600 mb-1 block">Estado</label>
        <input
          type="text"
          maxLength={2}
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
          placeholder="SP"
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        Definir como endereço principal
      </label>

      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg font-semibold"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
