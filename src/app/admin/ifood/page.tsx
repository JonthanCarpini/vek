'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, Settings, Power, Store,
  AlertTriangle, Package, Clock,
} from 'lucide-react';
import { formatBRL } from '@/lib/format';

interface IfoodUnit {
  ifoodEnabled: boolean;
  ifoodMerchantId: string;
  ifoodAutoConfirm: boolean;
  ifoodStoreStatus: string;
  ifoodLastPollAt: string | null;
}

interface IfoodConfigData {
  unit: IfoodUnit | null;
  credentialsConfigured: boolean;
  counters: { received: number; preparing: number; ready: number; delivered: number };
}

export default function IfoodAdmin() {
  const [data, setData] = useState<IfoodConfigData | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<'config' | 'orders' | 'status'>('config');
  const [merchantIdInput, setMerchantIdInput] = useState('');
  const [storeStatus, setStoreStatus] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setBusy(true);
      const res = await apiFetch('/api/v1/admin/ifood');
      setData(res);
      if (res?.unit?.ifoodMerchantId) setMerchantIdInput(res.unit.ifoodMerchantId);
      if (res?.unit?.ifoodEnabled) {
        const ord = await apiFetch('/api/v1/admin/ifood/orders?limit=20');
        setOrders(ord.orders || []);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function patchConfig(payload: any) {
    try {
      setBusy(true);
      await apiFetch('/api/v1/admin/ifood', { method: 'PATCH', body: JSON.stringify(payload) });
      await load();
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  async function refreshStoreStatus() {
    try {
      setBusy(true);
      const res = await apiFetch('/api/v1/admin/ifood/status');
      setStoreStatus(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder(orderId: string) {
    try {
      setBusy(true);
      await apiFetch(`/api/v1/admin/ifood/orders/${orderId}/confirm`, { method: 'POST' });
      await load();
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  async function dispatchOrder(orderId: string) {
    try {
      setBusy(true);
      await apiFetch(`/api/v1/admin/ifood/orders/${orderId}/dispatch`, { method: 'POST' });
      await load();
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  async function cancelOrder(orderId: string) {
    const reason = prompt('Motivo do cancelamento:');
    if (!reason) return;
    const code = prompt('Código de cancelamento iFood (ex: 501):') || '501';
    try {
      setBusy(true);
      await apiFetch(`/api/v1/admin/ifood/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason, cancellationCode: code }),
      });
      await load();
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  if (!data && busy) {
    return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto mb-2" /> Carregando...</div>;
  }

  const unit = data?.unit;
  const enabled = !!unit?.ifoodEnabled;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🛵 Integração iFood</h1>
          <p className="text-gray-400 text-sm">Receba pedidos do iFood direto na sua cozinha.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${enabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
            {enabled ? 'HABILITADO' : 'DESABILITADO'}
          </span>
          <button
            onClick={() => patchConfig({ ifoodEnabled: !enabled })}
            disabled={busy || !data?.credentialsConfigured}
            className={`btn ${enabled ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20' : 'btn-primary'}`}
          >
            {enabled ? 'Desativar' : 'Ativar Integração'}
          </button>
        </div>
      </header>

      {!data?.credentialsConfigured && (
        <div className="card p-4 bg-amber-600/10 border-amber-600/20 flex items-start gap-3">
          <AlertTriangle className="text-amber-400 mt-1" />
          <div>
            <h3 className="font-bold text-amber-300">Credenciais não configuradas</h3>
            <p className="text-sm text-gray-400">
              Defina <code>IFOOD_CLIENT_ID</code> e <code>IFOOD_CLIENT_SECRET</code> no arquivo <code>.env</code> do servidor e reinicie a aplicação.
            </p>
          </div>
        </div>
      )}

      {enabled && (
        <div className="grid grid-cols-4 gap-4">
          <Counter label="Aguardando" value={data?.counters.received || 0} icon="⏳" color="amber" />
          <Counter label="Em Preparo" value={data?.counters.preparing || 0} icon="👨‍🍳" color="blue" />
          <Counter label="Prontos" value={data?.counters.ready || 0} icon="✅" color="green" />
          <Counter label="Despachados" value={data?.counters.delivered || 0} icon="🛵" color="brand" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        <TabButton active={tab === 'config'} onClick={() => setTab('config')} icon={<Settings size={16} />} label="Configuração" />
        <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<Package size={16} />} label="Pedidos" disabled={!enabled} />
        <TabButton active={tab === 'status'} onClick={() => setTab('status')} icon={<Store size={16} />} label="Status da Loja" disabled={!enabled} />
      </div>

      {tab === 'config' && (
        <section className="card p-6 space-y-4">
          <h2 className="font-bold text-lg">Configuração</h2>
          <div>
            <label className="label">Merchant ID do iFood</label>
            <input
              className="input"
              value={merchantIdInput}
              onChange={(e) => setMerchantIdInput(e.target.value)}
              placeholder="ex: a1b2c3d4-e5f6-..."
            />
            <p className="text-xs text-gray-500 mt-1">Obtido no Portal do Desenvolvedor iFood, em "Merchants".</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoconfirm"
              checked={!!unit?.ifoodAutoConfirm}
              onChange={(e) => patchConfig({ ifoodAutoConfirm: e.target.checked })}
              disabled={busy}
            />
            <label htmlFor="autoconfirm" className="text-sm">
              Confirmar pedidos automaticamente ao recebê-los
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => patchConfig({ ifoodMerchantId: merchantIdInput })}
              disabled={busy}
              className="btn btn-primary"
            >
              Salvar Merchant ID
            </button>
          </div>
        </section>
      )}

      {tab === 'orders' && (
        <section className="card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Pedidos iFood (20 mais recentes)</h2>
            <button onClick={load} disabled={busy} className="btn btn-ghost flex items-center gap-2">
              <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum pedido iFood ainda.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="border border-gray-800 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">#{o.sequenceNumber} · {o.ifoodDisplayId || o.ifoodOrderId?.slice(0, 8)}</div>
                      <div className="text-sm text-gray-400">{o.customerName} · {o.customerPhone}</div>
                      {o.deliveryAddress && <div className="text-xs text-gray-500 mt-1">📍 {o.deliveryAddress}</div>}
                    </div>
                    <StatusBadge status={o.status} ifoodStatus={o.ifoodStatus} />
                  </div>
                  <div className="text-sm">
                    {o.items.map((i: any) => (
                      <div key={i.id} className="flex justify-between py-1 border-b border-gray-800/50 last:border-0">
                        <span>{i.quantity}x {i.name}</span>
                        <span className="text-gray-400">{formatBRL(i.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold">Total: {formatBRL(o.total)}</span>
                    <div className="flex gap-2">
                      {o.status === 'received' && (
                        <button onClick={() => confirmOrder(o.id)} disabled={busy} className="btn btn-primary btn-sm">Confirmar</button>
                      )}
                      {o.status === 'ready' && (
                        <button onClick={() => dispatchOrder(o.id)} disabled={busy} className="btn btn-primary btn-sm">Despachar</button>
                      )}
                      {!['cancelled', 'delivered'].includes(o.status) && (
                        <button onClick={() => cancelOrder(o.id)} disabled={busy} className="btn btn-sm bg-red-600/10 text-red-400 hover:bg-red-600/20">Cancelar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'status' && (
        <section className="card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Status da Loja no iFood</h2>
            <button onClick={refreshStoreStatus} disabled={busy} className="btn btn-ghost flex items-center gap-2">
              <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Verificar agora
            </button>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-xl">
            {storeStatus?.status === 'open' ? <CheckCircle2 className="text-green-400" size={32} /> :
              storeStatus?.status === 'closed' ? <XCircle className="text-red-400" size={32} /> :
              <Power className="text-gray-500" size={32} />}
            <div>
              <div className="font-bold">
                {storeStatus?.status === 'open' ? 'Aberta' : storeStatus?.status === 'closed' ? 'Fechada' : 'Desconhecido'}
              </div>
              {unit?.ifoodLastPollAt && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> Última verificação: {new Date(unit.ifoodLastPollAt).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </div>
          {storeStatus?.details && (
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-white">Detalhes técnicos</summary>
              <pre className="bg-gray-900 p-3 rounded-lg mt-2 overflow-auto">{JSON.stringify(storeStatus.details, null, 2)}</pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function Counter({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: any = {
    amber: 'bg-amber-600/10 text-amber-400',
    blue: 'bg-blue-600/10 text-blue-400',
    green: 'bg-green-600/10 text-green-400',
    brand: 'bg-brand-600/10 text-brand-400',
  };
  return (
    <div className={`card p-4 ${colors[color] || ''}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
        active ? 'border-brand-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon} {label}
    </button>
  );
}

function StatusBadge({ status, ifoodStatus }: { status: string; ifoodStatus?: string }) {
  const map: any = {
    received: { label: 'Aguardando', color: 'bg-amber-600/20 text-amber-400' },
    accepted: { label: 'Confirmado', color: 'bg-blue-600/20 text-blue-400' },
    preparing: { label: 'Preparando', color: 'bg-blue-600/20 text-blue-400' },
    ready: { label: 'Pronto', color: 'bg-green-600/20 text-green-400' },
    delivered: { label: 'Despachado', color: 'bg-gray-600/20 text-gray-300' },
    cancelled: { label: 'Cancelado', color: 'bg-red-600/20 text-red-400' },
  };
  const s = map[status] || { label: status, color: 'bg-gray-600/20' };
  return (
    <div className="text-right">
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.color}`}>{s.label}</span>
      {ifoodStatus && <div className="text-[10px] text-gray-500 mt-1">iFood: {ifoodStatus}</div>}
    </div>
  );
}
