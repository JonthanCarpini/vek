'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(7);

  useEffect(() => { load(); }, [days]);
  async function load() {
    try { setData(await apiFetch(`/api/v1/admin/reports/sales?days=${days}`)); } catch {}
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Relatórios de Vendas</h1>
        <select className="input max-w-[180px]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Hoje</option><option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="card p-5"><div className="text-sm text-gray-400">Pedidos</div><div className="text-3xl font-bold">{data.totals.orders}</div></div>
            <div className="card p-5"><div className="text-sm text-gray-400">Receita total</div><div className="text-3xl font-bold">R$ {data.totals.revenue.toFixed(2)}</div></div>
            <div className="card p-5"><div className="text-sm text-gray-400">Ticket médio</div><div className="text-3xl font-bold">R$ {data.totals.orders ? (data.totals.revenue / data.totals.orders).toFixed(2) : '0.00'}</div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="font-semibold mb-3">Por dia</div>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400"><th className="text-left p-2">Data</th><th className="text-right p-2">Pedidos</th><th className="text-right p-2">Receita</th></tr></thead>
                <tbody>
                  {data.byDay.map((d: any) => (
                    <tr key={d.date} className="border-t border-[color:var(--border)]">
                      <td className="p-2">{new Date(d.date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-2 text-right">{d.orders}</td>
                      <td className="p-2 text-right">R$ {d.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card p-4">
              <div className="font-semibold mb-3">Top produtos</div>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400"><th className="text-left p-2">Produto</th><th className="text-right p-2">Qtd</th><th className="text-right p-2">Receita</th></tr></thead>
                <tbody>
                  {data.topProducts.map((p: any) => (
                    <tr key={p.name} className="border-t border-[color:var(--border)]">
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-right">{p.quantity}</td>
                      <td className="p-2 text-right">R$ {p.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
