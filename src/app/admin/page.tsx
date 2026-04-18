'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { loadStaff } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'Pix', voucher: 'Vale', other: 'Outro',
};

export default function AdminDashboard() {
  const [m, setM] = useState<any>(null);
  const [storeDayId, setStoreDayId] = useState<string | null>(null);

  useEffect(() => {
    load();
    const s = loadStaff();
    if (s?.user.unitId) joinRooms([`unit:${s.user.unitId}:dashboard`]);
    const sock = getSocket();
    const r = () => load();
    sock.on('order.created', r); sock.on('order.updated', r); sock.on('session.closed', r); sock.on('session.payment_added', r);
    const i = setInterval(load, 10000);
    return () => {
      sock.off('order.created', r); sock.off('order.updated', r);
      sock.off('session.closed', r); sock.off('session.payment_added', r);
      clearInterval(i);
    };
  }, [storeDayId]);

  async function load() {
    try {
      const qs = storeDayId ? `?storeDayId=${storeDayId}` : '';
      const d = await apiFetch(`/api/v1/admin/dashboard${qs}`);
      setM(d.dashboard);
    } catch {}
  }

  const sd = m?.storeDay;
  const cards = [
    { label: 'Pedidos no período', value: m?.ordersToday ?? '—', icon: '🧾' },
    { label: 'Receita (pedidos)', value: m ? formatBRL(m.revenueToday) : '—', icon: '💰' },
    { label: 'Recebido (pagamentos)', value: m ? formatBRL(m.paidNet ?? 0) : '—', icon: '💳' },
    { label: 'Ticket médio', value: m ? formatBRL(m.avgTicket) : '—', icon: '📊' },
    { label: 'Mesas ocupadas', value: m?.openTables ?? '—', icon: '🪑' },
    { label: 'Pedidos ativos', value: m?.activeOrders ?? '—', icon: '⏱️' },
    { label: 'Chamadas pendentes', value: m?.pendingCalls ?? '—', icon: '🙋' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {storeDayId && <button onClick={() => setStoreDayId(null)} className="btn btn-ghost text-xs">Voltar para caixa atual</button>}
      </div>

      {/* Status do caixa */}
      {sd ? (
        <div className={`card p-4 mb-4 ${sd.status === 'open' ? 'border-green-500/40' : 'border-gray-700'}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{sd.status === 'open' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}</div>
              <div className="font-semibold text-sm mt-0.5">{new Date(sd.openedAt).toLocaleString('pt-BR')}</div>
            </div>
            <div className={`text-xs px-2 py-1 rounded-lg font-bold ${sd.status === 'open' ? 'bg-green-600/30 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {sd.status === 'open' ? 'Aberto' : 'Fechado'}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="bg-white/5 rounded-xl p-2">
              <div className="text-[10px] text-gray-500">Abertura</div>
              <div className="font-bold">{formatBRL(sd.openingCash)}</div>
            </div>
            {sd.closingCash != null && <div className="bg-white/5 rounded-xl p-2"><div className="text-[10px] text-gray-500">Fechamento</div><div className="font-bold">{formatBRL(sd.closingCash)}</div></div>}
            {sd.totalSales != null && <div className="bg-white/5 rounded-xl p-2"><div className="text-[10px] text-gray-500">Vendas</div><div className="font-bold text-green-400">{formatBRL(sd.totalSales)}</div></div>}
            {sd.cashDiff != null && <div className="bg-white/5 rounded-xl p-2"><div className="text-[10px] text-gray-500">Diferença</div><div className={`font-bold ${sd.cashDiff < 0 ? 'text-red-400' : sd.cashDiff > 0 ? 'text-amber-400' : 'text-green-400'}`}>{formatBRL(sd.cashDiff)}</div></div>}
          </div>
        </div>
      ) : (
        <div className="card p-4 mb-4 text-sm text-gray-400">Nenhum caixa aberto. <a href="/cashier" className="text-brand-400 underline">Abrir caixa</a></div>
      )}

      {/* Cards de métricas — 2 colunas no mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-3 sm:p-5 flex flex-col gap-2">
            <span className="text-2xl sm:text-3xl">{c.icon}</span>
            <div className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{c.label}</div>
            <div className="text-xl sm:text-3xl font-black text-white break-all leading-none">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Pagamentos por método */}
      {m?.paymentByMethod?.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="font-bold text-sm mb-3 flex items-center gap-2">
            <span>💳</span> Pagamentos por método
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            {m.paymentByMethod.map((p: any) => (
              <div key={p.method} className="bg-white/5 border border-gray-800 rounded-xl p-3">
                <div className="text-[10px] font-black text-gray-500 uppercase mb-1">{METHOD_LABELS[p.method] || p.method}</div>
                <div className="text-base font-black text-brand-500">{formatBRL(p.net)}</div>
                {p.changeGiven > 0 && <div className="text-[10px] text-red-400 mt-0.5">Troco: {formatBRL(p.changeGiven)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de caixas */}
      {m?.recentDays?.length > 0 && (
        <div className="card p-4">
          <div className="font-semibold text-sm mb-3">Últimos caixas fechados</div>
          <div className="flex flex-col gap-2">
            {m.recentDays.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3 text-sm gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 truncate">{new Date(d.openedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="font-bold">{formatBRL(d.totalSales)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold ${d.cashDiff < 0 ? 'text-red-400' : d.cashDiff > 0 ? 'text-amber-400' : 'text-green-400'}`}>{formatBRL(d.cashDiff)}</span>
                  <button onClick={() => setStoreDayId(d.id)} className="text-brand-400 text-xs bg-brand-500/10 px-2 py-1 rounded-lg">Ver</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
