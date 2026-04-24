'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';
import { Plus, History, Pencil, Trash2, ChevronDown, ChevronUp, PackageOpen } from 'lucide-react';

const UNITS = ['un', 'g', 'kg', 'ml', 'L'];

function stockColor(stock: number, minStock: number) {
  if (stock <= 0) return 'text-red-400';
  if (minStock > 0 && stock <= minStock) return 'text-yellow-400';
  return 'text-emerald-400';
}
function borderColor(stock: number, minStock: number) {
  if (stock <= 0) return 'border-l-red-500';
  if (minStock > 0 && stock <= minStock) return 'border-l-yellow-500';
  return 'border-l-transparent';
}

type StockFilter = 'all' | 'low' | 'zero';

export default function IngredientsPage() {
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState<StockFilter>('all');
  const [form, setForm] = useState<any>({ name: '', unitOfMeasure: 'un', minStock: 0, cost: 0, active: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Quick entry per ingredient: { [id]: string }
  const [quickEntry, setQuickEntry] = useState<Record<string, string>>({});
  const [quickBusy, setQuickBusy] = useState<Record<string, boolean>>({});
  // History expand per ingredient
  const [historyOpen, setHistoryOpen] = useState<Record<string, any[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, []);
  async function load() {
    try { const d = await apiFetch('/api/v1/admin/ingredients'); setList(d.ingredients); }
    catch (e: any) { setMsg(e.message); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const body = {
        name: form.name,
        unitOfMeasure: form.unitOfMeasure,
        stock: editing ? undefined : 0, // stock only on create (via adjustment later)
        minStock: Number(form.minStock) || 0,
        cost: Number(form.cost) || 0,
        active: !!form.active,
      };
      if (editing) {
        await apiFetch(`/api/v1/admin/ingredients/${editing}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/v1/admin/ingredients', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm({ name: '', unitOfMeasure: 'un', minStock: 0, cost: 0, active: true });
      setEditing(null); setShowForm(false);
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  function edit(i: any) {
    setEditing(i.id);
    setForm({ name: i.name, unitOfMeasure: i.unitOfMeasure, minStock: Number(i.minStock), cost: Number(i.cost), active: i.active });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(i: any) {
    if (!confirm(`Excluir "${i.name}"?`)) return;
    try { await apiFetch(`/api/v1/admin/ingredients/${i.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { alert(e.message); }
  }

  async function applyQuickEntry(i: any) {
    const raw = quickEntry[i.id] || '';
    const delta = Number(raw.replace(',', '.'));
    if (!raw || isNaN(delta) || delta === 0) return;
    setQuickBusy((b) => ({ ...b, [i.id]: true }));
    try {
      await apiFetch(`/api/v1/admin/ingredients/${i.id}/stock`, {
        method: 'POST',
        body: JSON.stringify({ delta, reason: delta > 0 ? 'Entrada' : 'Saída' }),
      });
      setQuickEntry((q) => ({ ...q, [i.id]: '' }));
      // Refresh history if open
      if (historyOpen[i.id]) loadHistory(i.id);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setQuickBusy((b) => ({ ...b, [i.id]: false })); }
  }

  async function loadHistory(id: string) {
    setHistoryLoading((h) => ({ ...h, [id]: true }));
    try {
      const d = await apiFetch(`/api/v1/admin/ingredients/${id}/stock?limit=15`);
      setHistoryOpen((h) => ({ ...h, [id]: d.history }));
    } catch { setHistoryOpen((h) => ({ ...h, [id]: [] })); }
    finally { setHistoryLoading((h) => ({ ...h, [id]: false })); }
  }

  function toggleHistory(id: string) {
    if (historyOpen[id]) {
      setHistoryOpen((h) => { const n = { ...h }; delete n[id]; return n; });
    } else {
      loadHistory(id);
    }
  }

  const counts = {
    all: list.length,
    low: list.filter((i) => Number(i.stock) > 0 && Number(i.minStock) > 0 && Number(i.stock) <= Number(i.minStock)).length,
    zero: list.filter((i) => Number(i.stock) <= 0).length,
  };

  const filtered = list.filter((i) => {
    if (filter === 'low') return Number(i.stock) > 0 && Number(i.minStock) > 0 && Number(i.stock) <= Number(i.minStock);
    if (filter === 'zero') return Number(i.stock) <= 0;
    return true;
  });

  function fmtStock(v: number) {
    return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
  }

  function actionLabel(action: string) {
    if (action === 'stock_deduct') return 'Pedido';
    if (action === 'stock_adjust') return 'Ajuste';
    return action;
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Ingredientes & Estoque</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ name: '', unitOfMeasure: 'un', minStock: 0, cost: 0, active: true }); }}
          className="btn btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={save} className="card p-4 mb-5 space-y-3">
          <div className="text-sm font-semibold text-gray-300">{editing ? 'Editando ingrediente' : 'Novo ingrediente'}</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Unidade</label>
              <select className="input" value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mínimo</label>
              <input className="input" type="number" step="0.001" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            </div>
            <div>
              <label className="label">Custo/un</label>
              <input className="input" type="number" step="0.0001" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Ativo
            </label>
            <button className="btn btn-primary" disabled={busy}>{editing ? 'Salvar' : 'Cadastrar'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn btn-ghost">Cancelar</button>
            {msg && <span className="text-sm text-red-400">{msg}</span>}
          </div>
          {!editing && <p className="text-xs text-gray-500">O estoque inicial é zero. Use a entrada de estoque na linha do ingrediente para registrar a quantidade.</p>}
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-3">
        {([['all', 'Todos'], ['low', 'Baixo estoque'], ['zero', 'Zerados']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${filter === v ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            {label}
            {counts[v] > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${v === 'zero' ? 'bg-red-500/20 text-red-400' : v === 'low' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-300'}`}>{counts[v]}</span>}
          </button>
        ))}
      </div>

      {/* Ingredient list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-gray-500 flex flex-col items-center gap-2">
            <PackageOpen className="w-8 h-8 opacity-40" />
            {filter === 'all' ? 'Nenhum ingrediente cadastrado' : filter === 'zero' ? 'Nenhum ingrediente zerado' : 'Nenhum ingrediente com estoque baixo'}
          </div>
        )}

        {filtered.map((i) => {
          const stock = Number(i.stock);
          const minStock = Number(i.minStock);
          const pct = minStock > 0 ? Math.min(100, (stock / minStock) * 100) : null;
          const historyEntries = historyOpen[i.id];
          const isHOpen = !!historyEntries;

          return (
            <div key={i.id} className={`card border-l-4 ${borderColor(stock, minStock)} ${!i.active ? 'opacity-60' : ''}`}>
              {/* Main row */}
              <div className="p-3 flex items-center gap-3">
                {/* Stock info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{i.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">{i.unitOfMeasure}</span>
                    {!i.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Inativo</span>}
                    {i._count?.products > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {i._count.products} produto{i._count.products !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className={`text-sm font-bold tabular-nums ${stockColor(stock, minStock)}`}>
                      {fmtStock(stock)} {i.unitOfMeasure}
                    </span>
                    {minStock > 0 && (
                      <span className="text-xs text-gray-500">mín: {fmtStock(minStock)}</span>
                    )}
                    {Number(i.cost) > 0 && (
                      <span className="text-xs text-gray-600">{formatBRL(Number(i.cost))}/un</span>
                    )}
                  </div>
                  {/* Stock bar */}
                  {pct !== null && (
                    <div className="mt-1.5 h-1 w-full max-w-[120px] rounded-full bg-gray-800">
                      <div
                        className={`h-1 rounded-full transition-all ${pct <= 0 ? 'bg-red-500' : pct <= 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Quick entry */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="±qtd"
                    value={quickEntry[i.id] || ''}
                    onChange={(e) => setQuickEntry((q) => ({ ...q, [i.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && applyQuickEntry(i)}
                    className="input w-20 text-xs py-1.5 text-center"
                    title="Positivo = entrada, negativo = saída"
                  />
                  <button
                    onClick={() => applyQuickEntry(i)}
                    disabled={!quickEntry[i.id] || quickBusy[i.id]}
                    className="btn btn-primary py-1.5 px-2.5 text-xs disabled:opacity-40"
                    title="Aplicar ajuste de estoque"
                  >
                    ✓
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleHistory(i.id)}
                    title="Histórico de movimentações"
                    className={`p-2 rounded-lg transition ${isHOpen ? 'text-brand-400 bg-brand-500/10' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button onClick={() => edit(i)} className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(i)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* History */}
              {isHOpen && (
                <div className="border-t border-gray-800 px-3 pb-3">
                  {historyLoading[i.id] ? (
                    <div className="py-4 text-center text-xs text-gray-500">Carregando...</div>
                  ) : historyEntries.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-500">Sem histórico</div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Histórico de movimentações</div>
                      {historyEntries.map((h: any) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-14 text-center px-1.5 py-0.5 rounded text-[10px] font-medium ${h.action === 'stock_deduct' ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                            {actionLabel(h.action)}
                          </span>
                          <span className={h.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {h.delta >= 0 ? '+' : ''}{String(h.delta ?? h.qty ?? '').replace('.', ',')}
                            {h.qty && !h.delta ? `-${String(h.qty).replace('.', ',')}` : ''}
                          </span>
                          {h.reason && <span className="text-gray-500">· {h.reason}</span>}
                          {h.newStock !== undefined && (
                            <span className="text-gray-600">→ {String(Number(h.newStock)).replace('.', ',')}</span>
                          )}
                          <span className="ml-auto text-gray-700 tabular-nums">
                            {new Date(h.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 mt-3">
        Use valor positivo para entrada e negativo para saída. Produtos com ingrediente zerado são pausados automaticamente.
      </p>
    </div>
  );
}
