'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';
import {
  TrendingUp, ShoppingCart, DollarSign, Ban,
  Clock, Bike, UtensilsCrossed, ShoppingBag,
  CreditCard, Download,
} from 'lucide-react';

const PERIOD_OPTIONS = [
  { value: 1,  label: 'Hoje' },
  { value: 7,  label: 'Últimos 7 dias' },
  { value: 14, label: 'Últimos 14 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
];

const CHANNEL_ICONS: Record<string, any> = {
  'dine-in':  { Icon: UtensilsCrossed, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  delivery:   { Icon: Bike,            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ifood:      { Icon: ShoppingBag,     color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
};

function formatPct(v: number) { return `${v.toFixed(1)}%`; }
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/v1/admin/reports/sales?days=${days}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const maxDayRevenue = useMemo(
    () => data ? Math.max(...data.byDay.map((d: any) => d.revenue), 1) : 1,
    [data],
  );
  const maxHourOrders = useMemo(
    () => data ? Math.max(...data.byHour.map((h: any) => h.orders), 1) : 1,
    [data],
  );

  function downloadCSV() {
    if (!data) return;
    const rows = [
      ['Data', 'Pedidos', 'Receita'],
      ...data.byDay.map((d: any) => [fmtDate(d.date), d.orders, d.revenue.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(';')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(csv);
    a.download = `relatorio-${days}d.csv`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-gray-400">Análise completa de vendas e operação</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input max-w-[200px]"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={downloadCSV}
            disabled={!data}
            className="btn btn-secondary text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-28 animate-pulse bg-white/5" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5" />}
              label="Total de pedidos"
              value={String(data.totals.orders)}
              sub={`${data.totals.cancelled} cancelados (${formatPct(data.totals.cancellationRate)})`}
              color="text-orange-400"
            />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Receita total"
              value={formatBRL(data.totals.revenue)}
              sub="pedidos concluídos"
              color="text-emerald-400"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Ticket médio"
              value={formatBRL(data.totals.avgTicket)}
              sub="por pedido"
              color="text-indigo-400"
            />
            <KpiCard
              icon={<Ban className="w-5 h-5" />}
              label="Cancelados"
              value={String(data.totals.cancelled)}
              sub={formatPct(data.totals.cancellationRate) + ' do total'}
              color="text-red-400"
            />
          </div>

          {/* Por canal */}
          {data.byChannel.length > 0 && (
            <Section title="Por canal">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.byChannel.map((c: any) => {
                  const meta = CHANNEL_ICONS[c.channel] || CHANNEL_ICONS['dine-in'];
                  const { Icon, color, bg } = meta;
                  return (
                    <div key={c.channel} className={`card p-4 border ${bg}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="font-semibold text-sm">{c.label}</span>
                        <span className="ml-auto text-xs text-gray-400">{formatPct(c.pct)}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pedidos</span>
                          <span className="font-medium">{c.orders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Receita</span>
                          <span className={`font-bold ${color}`}>{formatBRL(c.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Ticket médio</span>
                          <span>{formatBRL(c.avgTicket)}</span>
                        </div>
                        {c.deliveryFee > 0 && (
                          <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-white/5">
                            <span>Taxa de entrega</span>
                            <span>{formatBRL(c.deliveryFee)}</span>
                          </div>
                        )}
                      </div>
                      {/* Barra de participação */}
                      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.deliveryMetrics?.count > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400 bg-white/5 rounded-xl px-4 py-2 w-fit">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Tempo médio de entrega (aceito → entregue):
                  <span className="text-emerald-400 font-semibold">
                    {data.deliveryMetrics.avgTimeMin}min
                  </span>
                  <span className="text-gray-500">({data.deliveryMetrics.count} entregas)</span>
                </div>
              )}
            </Section>
          )}

          {/* Receita por dia */}
          {data.byDay.length > 0 && (
            <Section title="Receita por dia">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gráfico de barras CSS */}
                <div className="space-y-2">
                  {data.byDay.map((d: any) => (
                    <div key={d.date} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-12 text-right flex-shrink-0">{fmtDate(d.date)}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full bg-orange-500/70 rounded-full flex items-center pl-2 text-[11px] text-white/80 font-medium transition-all"
                          style={{ width: `${Math.max((d.revenue / maxDayRevenue) * 100, 2)}%` }}
                        >
                          {d.revenue > maxDayRevenue * 0.3 && formatBRL(d.revenue)}
                        </div>
                      </div>
                      <span className="text-gray-400 flex-shrink-0 w-8 text-right">{d.orders}</span>
                    </div>
                  ))}
                </div>

                {/* Tabela */}
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase">
                        <th className="text-left py-2 px-1">Data</th>
                        <th className="text-right py-2 px-1">Pedidos</th>
                        <th className="text-right py-2 px-1">Receita</th>
                        <th className="text-right py-2 px-1">Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.byDay].reverse().map((d: any) => (
                        <tr key={d.date} className="border-t border-[var(--border)]">
                          <td className="py-2 px-1 text-gray-300">{fmtDate(d.date)}</td>
                          <td className="py-2 px-1 text-right">{d.orders}</td>
                          <td className="py-2 px-1 text-right text-orange-400 font-medium">{formatBRL(d.revenue)}</td>
                          <td className="py-2 px-1 text-right text-gray-400">
                            {d.orders ? formatBRL(d.revenue / d.orders) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}

          {/* Horários de pico */}
          <Section title="Horários de pico">
            <div className="flex items-end gap-1 h-24">
              {data.byHour.map((h: any) => {
                const pct = (h.orders / maxHourOrders) * 100;
                const isActive = h.orders > 0;
                return (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center gap-0.5 group"
                    title={`${h.label}: ${h.orders} pedidos — ${formatBRL(h.revenue)}`}
                  >
                    <div className="w-full flex flex-col justify-end" style={{ height: 72 }}>
                      <div
                        className={`w-full rounded-t transition-all ${isActive ? 'bg-indigo-500/60 group-hover:bg-indigo-400' : 'bg-white/5'}`}
                        style={{ height: `${Math.max(pct, isActive ? 4 : 0)}%` }}
                      />
                    </div>
                    {(h.hour % 4 === 0) && (
                      <span className="text-[9px] text-gray-600">{h.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">Passe o mouse sobre as barras para ver detalhes por hora</p>
          </Section>

          {/* Por forma de pagamento */}
          {data.byPayment.length > 0 && (
            <Section title="Por forma de pagamento">
              <div className="space-y-2">
                {data.byPayment.map((p: any) => (
                  <div key={p.method} className="flex items-center gap-3 text-sm">
                    <CreditCard className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="w-36 text-gray-300 truncate">{p.method}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/50 rounded-full"
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-gray-400">{p.orders}x</span>
                    <span className="w-28 text-right font-medium text-gray-200">{formatBRL(p.revenue)}</span>
                    <span className="w-12 text-right text-gray-500 text-xs">{formatPct(p.pct)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Top produtos */}
          {data.topProducts.length > 0 && (
            <Section title="Top produtos">
              <div className="space-y-2">
                {data.topProducts.map((p: any, i: number) => (
                  <div key={p.name} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-gray-600 text-xs text-right">{i + 1}.</span>
                    <span className="flex-1 text-gray-200 truncate">{p.name}</span>
                    <div className="w-32 bg-white/5 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-orange-500/50 rounded-full"
                        style={{ width: `${p.pct * 3}%`, maxWidth: '100%' }}
                      />
                    </div>
                    <span className="w-12 text-right text-gray-400">{p.quantity}x</span>
                    <span className="w-28 text-right font-medium text-orange-400">{formatBRL(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="card p-12 text-center text-gray-500">
          Erro ao carregar relatório. Tente novamente.
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="card p-4">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  );
}
