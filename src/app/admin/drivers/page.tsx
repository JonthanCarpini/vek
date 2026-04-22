'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Power, Check } from 'lucide-react';
import { apiFetch } from '@/lib/staff-client';

const VEHICLE_LABEL: Record<string, string> = {
  moto: '🏍️ Moto', bike: '🚲 Bike', carro: '🚗 Carro', pe: '🚶 A pé',
};

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/v1/admin/drivers');
      setDrivers(data.drivers || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Inativar este motoboy? O histórico será preservado.')) return;
    try {
      await apiFetch(`/api/v1/admin/drivers/${id}`, { method: 'DELETE' });
    } catch (e: any) { alert(e.message); }
    load();
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/api/v1/admin/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !active }),
      });
    } catch (e: any) { alert(e.message); }
    load();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">🏍️ Entregadores</h1>
          <p className="text-sm text-gray-500 mt-1">Motoboys da unidade</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo motoboy
        </button>
      </header>

      {loading ? (
        <div className="text-center text-gray-500 py-10">Carregando...</div>
      ) : drivers.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-white rounded-lg border">
          Nenhum motoboy cadastrado. Adicione o primeiro clicando em &quot;Novo motoboy&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <div
              key={d.id}
              className={`bg-white rounded-lg border p-4 flex flex-wrap items-center gap-3 ${
                !d.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{d.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                    {VEHICLE_LABEL[d.vehicle] || d.vehicle}
                  </span>
                  {d.hasPin && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                      🔐 PIN
                    </span>
                  )}
                  {!d.active && (
                    <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded">
                      Inativo
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  {d.phone}
                  {d.licensePlate && ` • ${d.licensePlate}`}
                  {' • '}
                  {d.totalDeliveries} entrega{d.totalDeliveries !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleActive(d.id, d.active)}
                  title={d.active ? 'Inativar' : 'Ativar'}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <Power className={`w-4 h-4 ${d.active ? 'text-green-600' : 'text-gray-400'}`} />
                </button>
                <button
                  onClick={() => { setEditing(d); setShowForm(true); }}
                  title="Editar"
                  className="p-2 hover:bg-gray-100 rounded text-gray-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(d.id)}
                  title="Excluir"
                  className="p-2 hover:bg-red-50 rounded text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <DriverForm
          driver={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function DriverForm({
  driver, onClose, onSaved,
}: { driver: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: driver?.name || '',
    phone: driver?.phone || '',
    vehicle: driver?.vehicle || 'moto',
    licensePlate: driver?.licensePlate || '',
    pin: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!form.name || !form.phone) {
      setError('Nome e telefone são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const url = driver
        ? `/api/v1/admin/drivers/${driver.id}`
        : `/api/v1/admin/drivers`;
      const method = driver ? 'PATCH' : 'POST';

      const payload: any = {
        name: form.name,
        phone: form.phone,
        vehicle: form.vehicle,
        licensePlate: form.licensePlate || null,
      };
      if (form.pin) payload.pin = form.pin;

      try {
        await apiFetch(url, { method, body: JSON.stringify(payload) });
        onSaved();
      } catch (e: any) {
        setError(e.message || 'Erro ao salvar');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold">{driver ? 'Editar motoboy' : 'Novo motoboy'}</h2>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Nome completo</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Telefone (WhatsApp)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Veículo</label>
            <select
              value={form.vehicle}
              onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="moto">Moto</option>
              <option value="bike">Bicicleta</option>
              <option value="carro">Carro</option>
              <option value="pe">A pé</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Placa (opcional)</label>
            <input
              type="text"
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })}
              placeholder="ABC-1234"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">
              PIN de acesso (4-6 dígitos){driver && ' — deixe em branco para manter atual'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              placeholder="Ex: 1234"
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Usado para o motoboy acessar a área /driver
            </p>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>
        <div className="p-5 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
