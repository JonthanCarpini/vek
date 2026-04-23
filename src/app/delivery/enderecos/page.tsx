'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Trash2, X, Loader2, Check } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { deliveryApi, maskCEP } from '../_lib/api';
import { SkeletonList } from '../_components/Skeleton';

export default function EnderecosPage() {
  const router = useRouter();
  const { customer, addresses, loadingAddresses, reloadAddresses } = useDelivery();
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!customer) {
      router.replace('/delivery/perfil');
    }
  }, [customer, router]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este endereço?')) return;
    const res = await deliveryApi.deleteAddress(id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    await reloadAddresses();
  };

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">Meus endereços</h1>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-1 text-sm font-semibold text-orange-500"
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        {loadingAddresses && addresses.length === 0 ? (
          <SkeletonList count={3} />
        ) : addresses.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm mb-4">Você ainda não tem endereços salvos</p>
            <button
              onClick={() => setModal(true)}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-full font-semibold text-sm"
            >
              Adicionar endereço
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl p-4 flex items-start gap-3"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  {a.label && (
                    <div className="font-semibold text-gray-800 text-sm">{a.label}</div>
                  )}
                  <div className="text-sm text-gray-700">
                    {a.street}{a.number ? `, ${a.number}` : ''}
                  </div>
                  {a.complement && (
                    <div className="text-xs text-gray-500">{a.complement}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.neighborhood && `${a.neighborhood} · `}
                    {a.city}/{a.state} · CEP {maskCEP(a.zipCode || '')}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-2 hover:bg-red-50 rounded-full text-red-500 flex-shrink-0"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <AddAddressModal
          onClose={() => setModal(false)}
          onSaved={async () => {
            await reloadAddresses();
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

function AddAddressModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    label: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCEPBlur = async () => {
    const cep = form.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setLooking(true);
    const res = await deliveryApi.lookupZip(cep);
    setLooking(false);
    if (res.ok && res.data) {
      setForm((f) => ({
        ...f,
        street: res.data.logradouro || f.street,
        neighborhood: res.data.bairro || f.neighborhood,
        city: res.data.localidade || f.city,
        state: res.data.uf || f.state,
      }));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.street || !form.city || !form.state || !form.zipCode) {
      setError('Preencha rua, cidade, estado e CEP');
      return;
    }
    setSaving(true);
    const res = await deliveryApi.createAddress({
      ...form,
      zipCode: form.zipCode.replace(/\D/g, ''),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Novo endereço</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </header>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600">Apelido (opcional)</label>
            <input
              type="text"
              placeholder="Casa, Trabalho..."
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">CEP *</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={maskCEP(form.zipCode)}
                onChange={(e) => setForm({ ...form, zipCode: e.target.value.replace(/\D/g, '') })}
                onBlur={handleCEPBlur}
                placeholder="00000-000"
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
              {looking && (
                <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-orange-500" />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Rua *</label>
            <input
              type="text"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Número</label>
              <input
                type="text"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Complemento</label>
              <input
                type="text"
                value={form.complement}
                onChange={(e) => setForm({ ...form, complement: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Bairro</label>
            <input
              type="text"
              value={form.neighborhood}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div>
              <label className="text-xs text-gray-600">Cidade *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">UF *</label>
              <input
                type="text"
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm uppercase"
              />
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
              {error}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t p-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-full font-semibold flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Salvar endereço</>}
          </button>
        </div>
      </div>
    </div>
  );
}
