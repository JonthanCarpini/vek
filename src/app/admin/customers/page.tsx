'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';

export default function CustomersPage() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function load() {
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      const d = await apiFetch(`/api/v1/admin/customers${qs}`);
      setList(d.customers || []);
    } catch {}
  }

  async function openDetail(c: any) {
    setSelected(c); setDetail(null); setLoading(true);
    try {
      const d = await apiFetch(`/api/v1/admin/customers/${c.id}`);
      setDetail(d);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Clientes</h1>

      <div className="card p-3 mb-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="label">Buscar por telefone ou nome</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex: 11999999999 ou Maria" />
        </div>
        <div className="text-sm text-gray-400">{list.length} cliente(s)</div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-right p-3">Pedidos</th>
              <th className="text-right p-3">Total gasto</th>
              <th className="text-right p-3">Ticket médio</th>
              <th className="text-left p-3">Última visita</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 p-10">Nenhum cliente encontrado</td></tr>}
            {list.map((c) => (
              <tr key={c.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-xs">{c.phone}</td>
                <td className="p-3 text-right">{c.totalOrders}</td>
                <td className="p-3 text-right">{formatBRL(c.totalSpent)}</td>
                <td className="p-3 text-right">{formatBRL(c.avgTicket)}</td>
                <td className="p-3 text-xs text-gray-400">{new Date(c.lastSeenAt).toLocaleString('pt-BR')}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openDetail(c)} className="text-xs text-brand-400 hover:underline">Ver detalhes</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#0b0b0f] border border-[color:var(--border)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-3 border-b border-[color:var(--border)] flex justify-between items-center">
              <div>
                <div className="text-lg font-bold">{selected.name}</div>
                <div className="text-xs text-gray-400">{selected.phone}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-xl">×</button>
            </header>
            <div className="p-5 overflow-y-auto flex-1">
              {loading && <div className="text-gray-400">Carregando...</div>}
              {detail && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <Stat label="Pedidos" value={detail.customer.totalOrders} />
                    <Stat label="Total gasto" value={formatBRL(detail.customer.totalSpent)} />
                    <Stat label="Ticket médio" value={formatBRL(detail.customer.avgTicket)} />
                    <Stat label="Desde" value={new Date(detail.customer.firstSeenAt).toLocaleDateString('pt-BR')} />
                  </div>
                  <div className="font-semibold mb-2">Histórico de sessões</div>
                  {detail.sessions.length === 0 && <div className="text-gray-500 text-sm">Nenhuma sessão registrada.</div>}
                  <div className="space-y-2">
                    {detail.sessions.map((s: any) => (
                      <div key={s.id} className="border border-gray-800 rounded-lg p-3">
                        <div className="flex flex-wrap justify-between gap-3">
                          <div className="text-sm">
                            Mesa <b>{s.tableNumber}</b> · {new Date(s.openedAt).toLocaleString('pt-BR')}
                            {s.closedAt && <span className="text-gray-500"> → {new Date(s.closedAt).toLocaleString('pt-BR')}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`badge ${s.status === 'closed' ? '' : 'badge-warn'}`}>{s.status}</span>
                            <span className="font-bold">{formatBRL(s.totalAmount)}</span>
                          </div>
                        </div>
                        {s.orders.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {s.orders.map((o: any) => (
                              <span key={o.id} className="bg-gray-800 px-2 py-1 rounded">
                                #{o.sequenceNumber} — {formatBRL(o.total)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
