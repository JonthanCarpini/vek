'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { ImageUpload } from '@/components/ImageUpload';
import { BusinessHoursEditor } from '@/components/BusinessHoursEditor';
import { StoreOverridePanel } from '@/components/StoreOverridePanel';

type Tab = 'info' | 'hours' | 'override';

export default function SettingsPage() {
  const [unit, setUnit] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => { load(); }, []);
  async function load() {
    try { const d = await apiFetch('/api/v1/admin/settings'); setUnit(d.unit); } catch (e: any) { setMsg(e.message); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      const d = await apiFetch('/api/v1/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: unit.name,
          address: unit.address,
          phone: unit.phone,
          whatsapp: unit.whatsapp,
          logoUrl: unit.logoUrl,
          primaryColor: unit.primaryColor,
          serviceFee: Number(unit.serviceFee),
        }),
      });
      setUnit(d.unit); setMsg('Salvo com sucesso!');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  if (!unit) return <div className="text-gray-400">Carregando...</div>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Configurações</h1>

      <div className="flex gap-2 mb-4 border-b border-gray-800">
        {([['info', 'Informações'], ['hours', 'Horários'], ['override', 'Abrir/Fechar']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === k ? 'border-brand-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <form onSubmit={save} className="card p-5 space-y-4">
          <ImageUpload label="Logo" value={unit.logoUrl} onChange={(url) => setUnit({ ...unit, logoUrl: url })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nome do restaurante</label>
              <input className="input" value={unit.name || ''} onChange={(e) => setUnit({ ...unit, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Cor primária</label>
              <div className="flex gap-2">
                <input type="color" className="h-10 w-14 rounded cursor-pointer border border-gray-700 bg-transparent" value={unit.primaryColor || '#ea580c'} onChange={(e) => setUnit({ ...unit, primaryColor: e.target.value })} />
                <input className="input flex-1" value={unit.primaryColor || ''} onChange={(e) => setUnit({ ...unit, primaryColor: e.target.value })} placeholder="#ea580c" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Endereço</label>
              <input className="input" value={unit.address || ''} onChange={(e) => setUnit({ ...unit, address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={unit.phone || ''} onChange={(e) => setUnit({ ...unit, phone: e.target.value })} placeholder="(11) 99999-0000" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input className="input" value={unit.whatsapp || ''} onChange={(e) => setUnit({ ...unit, whatsapp: e.target.value })} placeholder="5511999990000" />
            </div>
            <div>
              <label className="label">Taxa de serviço (0 a 1, ex: 0.10 = 10%)</label>
              <input className="input" type="number" step="0.01" min="0" max="1" value={unit.serviceFee || 0} onChange={(e) => setUnit({ ...unit, serviceFee: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
            {msg && <span className="text-sm text-gray-300">{msg}</span>}
          </div>
        </form>
      )}

      {tab === 'hours' && <BusinessHoursEditor />}
      {tab === 'override' && <StoreOverridePanel />}
    </div>
  );
}
