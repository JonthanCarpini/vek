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

      {/* Status do dia */}
      {sd ? (
        <div className={`card p-4 mb-4 ${sd.status === 'open' ? 'border-green-500/40' : 'border-gray-700'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">{sd.status === 'open' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}</div>
              <div className="font-semibold">
                {new Date(sd.openedAt).toLocaleString('pt-BR')}
                {sd.closedAt && <> → {new Date(sd.closedAt).toLocaleString('pt-BR')}</>}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-gray-400">Abertura:</span> <b>{formatBRL(sd.openingCash)}</b></div>
              {sd.closingCash != null && <div><span className="text-gray-400">Fechamento:</span> <b>{formatBRL(sd.closingCash)}</b></div>}
              {sd.expectedCash != null && <div><span className="text-gray-400">Esperado:</span> <b>{formatBRL(sd.expectedCash)}</b></div>}
              {sd.cashDiff != null && <div><span className="text-gray-400">Diferença:</span> <b className={sd.cashDiff < 0 ? 'text-red-400' : sd.cashDiff > 0 ? 'text-amber-400' : 'text-green-400'}>{formatBRL(sd.cashDiff)}</b></div>}
              {sd.totalSales != null && <div><span className="text-gray-400">Vendas:</span> <b>{formatBRL(sd.totalSales)}</b></div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 mb-4 text-sm text-gray-400">Nenhum caixa aberto — abra no <a href="/cashier" className="text-brand-400 underline">/cashier</a>. Mostrando dados desde 00:00.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-6 flex flex-col justify-between hover:border-brand-500/30 transition-colors group">
            <div>
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform w-fit">{c.icon}</div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{c.label}</div>
            </div>
            <div className="text-3xl font-black text-white mt-1 break-all">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Pagamentos por método */}
      {m?.paymentByMethod?.length > 0 && (
        <div className="card p-6 mb-6 border-brand-500/5">
          <div className="font-bold text-lg mb-4 flex items-center gap-2">
            <span>💳</span> Pagamentos por método
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {m.paymentByMethod.map((p: any) => (
              <div key={p.method} className="bg-white/5 border border-gray-800 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">{METHOD_LABELS[p.method] || p.method}</div>
                <div className="text-xl font-black text-brand-500">{formatBRL(p.net)}</div>
                {p.changeGiven > 0 && <div className="text-[10px] text-red-400 font-medium mt-1">Troco: {formatBRL(p.changeGiven)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de caixas */}
      {m?.recentDays?.length > 0 && (
        <div className="card p-5">
          <div className="font-semibold mb-3">Últimos caixas fechados</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left p-2">Abertura</th>
                  <th className="text-left p-2">Fechamento</th>
                  <th className="text-right p-2">Vendas</th>
                  <th className="text-right p-2">Diferença</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {m.recentDays.map((d: any) => (
                  <tr key={d.id} className="border-t border-gray-800">
                    <td className="p-2">{new Date(d.openedAt).toLocaleString('pt-BR')}</td>
                    <td className="p-2">{d.closedAt ? new Date(d.closedAt).toLocaleString('pt-BR') : '—'}</td>
                    <td className="p-2 text-right">{formatBRL(d.totalSales)}</td>
                    <td className={`p-2 text-right ${d.cashDiff < 0 ? 'text-red-400' : d.cashDiff > 0 ? 'text-amber-400' : 'text-green-400'}`}>{formatBRL(d.cashDiff)}</td>
                    <td className="p-2 text-right"><button onClick={() => setStoreDayId(d.id)} className="text-brand-400 text-xs hover:underline">Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
