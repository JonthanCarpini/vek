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
          <p className="text-sm text-gray-400 mt-1">Motoboys da unidade</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo motoboy
        </button>
      </header>

      {loading ? (
        <div className="text-center text-gray-400 py-10">Carregando...</div>
      ) : drivers.length === 0 ? (
        <div className="text-center text-gray-400 py-16 card">
          Nenhum motoboy cadastrado. Adicione o primeiro clicando em &quot;Novo motoboy&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <div
              key={d.id}
              className={`card p-4 flex flex-wrap items-center gap-3 ${
                !d.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded">
                    {VEHICLE_LABEL[d.vehicle] || d.vehicle}
                  </span>
                  {d.hasPin && (
                    <span className="text-xs px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                      🔐 PIN
                    </span>
                  )}
                  {!d.active && (
                    <span className="text-xs px-2 py-0.5 bg-red-600/20 text-red-400 rounded">
                      Inativo
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mt-0.5">
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
                  className="p-2 hover:bg-white/10 rounded"
                >
                  <Power className={`w-4 h-4 ${d.active ? 'text-green-400' : 'text-gray-500'}`} />
                </button>
                <button
                  onClick={() => { setEditing(d); setShowForm(true); }}
                  title="Editar"
                  className="p-2 hover:bg-white/10 rounded text-gray-300"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(d.id)}
                  title="Excluir"
                  className="p-2 hover:bg-red-600/20 rounded text-red-400"
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">{driver ? 'Editar motoboy' : 'Novo motoboy'}</h2>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Nome completo</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Telefone (WhatsApp)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Veículo</label>
            <select
              value={form.vehicle}
              onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              className="input w-full"
            >
              <option value="moto">Moto</option>
              <option value="bike">Bicicleta</option>
              <option value="carro">Carro</option>
              <option value="pe">A pé</option>
            </select>
          </div>
          <div>
            <label className="label">Placa (opcional)</label>
            <input
              type="text"
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })}
              placeholder="ABC-1234"
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">
              PIN de acesso (4-6 dígitos){driver && ' — deixe em branco para manter atual'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              placeholder="Ex: 1234"
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Usado para o motoboy acessar a área /driver
            </p>
          </div>
          {error && <div className="text-sm text-red-400 bg-red-600/10 border border-red-500/30 p-2 rounded">{error}</div>}
        </div>
        <div className="p-5 border-t border-[var(--border)] flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn btn-ghost flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
