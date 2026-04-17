'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { ImageUpload } from '@/components/ImageUpload';
import { BusinessHoursEditor } from '@/components/BusinessHoursEditor';
import { StoreOverridePanel } from '@/components/StoreOverridePanel';

type Tab = 'info' | 'payments' | 'gateway' | 'hours' | 'override';

const ALL_METHODS = [
  { id: 'cash', label: 'Dinheiro' },
  { id: 'credit', label: 'Cartão de crédito' },
  { id: 'debit', label: 'Cartão de débito' },
  { id: 'pix', label: 'Pix' },
  { id: 'voucher', label: 'Vale refeição' },
  { id: 'other', label: 'Outro' },
];

export default function SettingsPage() {
  const [unit, setUnit] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => { load(); }, []);
  async function load() {
    try { const d = await apiFetch('/api/v1/admin/settings'); setUnit(d.unit); } catch (e: any) { setMsg(e.message); }
  }

  async function save(patch: any) {
    setSaving(true); setMsg(null);
    try {
      const d = await apiFetch('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify(patch) });
      setUnit(d.unit); setMsg('Salvo com sucesso!');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  function onSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    save({
      name: unit.name,
      address: unit.address,
      phone: unit.phone,
      whatsapp: unit.whatsapp,
      instagram: unit.instagram,
      logoUrl: unit.logoUrl,
      primaryColor: unit.primaryColor,
      serviceFee: Number(unit.serviceFee),
    });
  }

  function toggleMethod(id: string) {
    const current = (unit.paymentMethods || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const next = current.includes(id) ? current.filter((m: string) => m !== id) : [...current, id];
    setUnit({ ...unit, paymentMethods: next.join(',') });
  }

  function savePayments() {
    save({ paymentMethods: unit.paymentMethods || 'cash' });
  }

  function saveGateway() {
    save({
      onlinePaymentEnabled: !!unit.onlinePaymentEnabled,
      onlinePaymentProvider: unit.onlinePaymentProvider || null,
      mpAccessToken: unit.mpAccessToken || null,
      mpPublicKey: unit.mpPublicKey || null,
      asaasApiKey: unit.asaasApiKey || null,
      asaasWebhookToken: unit.asaasWebhookToken || null,
    });
  }

  if (!unit) return <div className="text-gray-400">Carregando...</div>;

  const enabledMethods = (unit.paymentMethods || '').split(',').map((s: string) => s.trim()).filter(Boolean);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Configurações</h1>

      <div className="flex gap-1 mb-4 border-b border-gray-800 overflow-x-auto">
        {([
          ['info', '🏪 Informações'],
          ['payments', '💳 Pagamentos'],
          ['gateway', '🔗 Gateway online'],
          ['hours', '🕐 Horários'],
          ['override', '🚪 Abrir/Fechar'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'border-brand-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <form onSubmit={onSaveInfo} className="card p-5 space-y-4">
          <ImageUpload label="Logo do restaurante" value={unit.logoUrl} onChange={(url) => setUnit({ ...unit, logoUrl: url })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nome do restaurante</label>
              <input className="input" value={unit.name || ''} onChange={(e) => setUnit({ ...unit, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Cor primária</label>
              <div className="flex gap-2">
                <input type="color" className="h-10 w-14 rounded cursor-pointer border border-gray-700 bg-transparent"
                  value={unit.primaryColor || '#ea580c'} onChange={(e) => setUnit({ ...unit, primaryColor: e.target.value })} />
                <input className="input flex-1" value={unit.primaryColor || ''}
                  onChange={(e) => setUnit({ ...unit, primaryColor: e.target.value })} placeholder="#ea580c" />
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
              <label className="label">Instagram (apenas o @)</label>
              <input className="input" value={unit.instagram || ''} onChange={(e) => setUnit({ ...unit, instagram: e.target.value })} placeholder="@restaurante" />
            </div>
            <div>
              <label className="label">Taxa de serviço (0 a 1, ex: 0.10 = 10%)</label>
              <input className="input" type="number" step="0.01" min="0" max="1" value={unit.serviceFee || 0}
                onChange={(e) => setUnit({ ...unit, serviceFee: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar informações'}</button>
            {msg && <span className="text-sm text-gray-300">{msg}</span>}
          </div>
        </form>
      )}

      {tab === 'payments' && (
        <div className="card p-5 space-y-4">
          <div>
            <div className="font-semibold mb-1">Formas de pagamento aceitas no caixa</div>
            <p className="text-xs text-gray-400">Marque os métodos aceitos presencialmente. Esses aparecerão nos botões do caixa ao fechar a conta.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_METHODS.map((m) => {
              const on = enabledMethods.includes(m.id);
              return (
                <label key={m.id} className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 ${on ? 'border-brand-500 bg-brand-500/10' : 'border-gray-800 hover:border-gray-700'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleMethod(m.id)} />
                  <span className="font-medium">{m.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-3 items-center pt-2">
            <button onClick={savePayments} disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar métodos'}</button>
            {msg && <span className="text-sm text-gray-300">{msg}</span>}
          </div>
        </div>
      )}

      {tab === 'gateway' && (
        <div className="card p-5 space-y-4">
          <div>
            <div className="font-semibold mb-1">Gateway de pagamento online</div>
            <p className="text-xs text-gray-400">Habilite para permitir pagamento por Pix/cartão diretamente do cliente. Um provedor por vez.</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!unit.onlinePaymentEnabled}
              onChange={(e) => setUnit({ ...unit, onlinePaymentEnabled: e.target.checked })} />
            Habilitar pagamento online
          </label>

          <div>
            <label className="label">Provedor</label>
            <select className="input" value={unit.onlinePaymentProvider || ''}
              onChange={(e) => setUnit({ ...unit, onlinePaymentProvider: e.target.value || null })}
              disabled={!unit.onlinePaymentEnabled}>
              <option value="">— Selecione —</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="asaas">Asaas</option>
            </select>
          </div>

          {unit.onlinePaymentProvider === 'mercadopago' && (
            <div className="space-y-3 border border-gray-800 rounded-lg p-4">
              <div className="text-sm font-semibold">Credenciais Mercado Pago</div>
              <div>
                <label className="label">Access Token (APP_USR-...)</label>
                <input className="input" type="password" value={unit.mpAccessToken || ''}
                  onChange={(e) => setUnit({ ...unit, mpAccessToken: e.target.value })}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <label className="label">Public Key</label>
                <input className="input" value={unit.mpPublicKey || ''}
                  onChange={(e) => setUnit({ ...unit, mpPublicKey: e.target.value })}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <p className="text-xs text-gray-500">Obtenha as chaves em mercadopago.com.br → Suas integrações → Credenciais de produção.</p>
            </div>
          )}

          {unit.onlinePaymentProvider === 'asaas' && (
            <div className="space-y-3 border border-gray-800 rounded-lg p-4">
              <div className="text-sm font-semibold">Credenciais Asaas</div>
              <div>
                <label className="label">API Key</label>
                <input className="input" type="password" value={unit.asaasApiKey || ''}
                  onChange={(e) => setUnit({ ...unit, asaasApiKey: e.target.value })}
                  placeholder="$aact_prod_..." />
              </div>
              <div>
                <label className="label">Webhook Token</label>
                <input className="input" value={unit.asaasWebhookToken || ''}
                  onChange={(e) => setUnit({ ...unit, asaasWebhookToken: e.target.value })}
                  placeholder="token de autenticação do webhook" />
              </div>
              <p className="text-xs text-gray-500">Obtenha a API Key em asaas.com → Integrações → Integrações para API.</p>
            </div>
          )}

          <div className="flex gap-3 items-center pt-2">
            <button onClick={saveGateway} disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar gateway'}</button>
            {msg && <span className="text-sm text-gray-300">{msg}</span>}
          </div>
        </div>
      )}

      {tab === 'hours' && <BusinessHoursEditor />}
      {tab === 'override' && <StoreOverridePanel />}
    </div>
  );
}
