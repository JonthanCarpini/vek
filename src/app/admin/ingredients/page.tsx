'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';

const UNITS = ['un', 'g', 'kg', 'ml', 'L'];

export default function IngredientsPage() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', unitOfMeasure: 'un', stock: 0, minStock: 0, cost: 0, active: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<any>(null);
  const [stockDelta, setStockDelta] = useState('');
  const [stockReason, setStockReason] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    try { const d = await apiFetch('/api/v1/admin/ingredients'); setList(d.ingredients); } catch (e: any) { setMsg(e.message); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const body = {
        name: form.name,
        unitOfMeasure: form.unitOfMeasure,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        cost: Number(form.cost) || 0,
        active: !!form.active,
      };
      if (editing) {
        await apiFetch(`/api/v1/admin/ingredients/${editing}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/v1/admin/ingredients', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm({ name: '', unitOfMeasure: 'un', stock: 0, minStock: 0, cost: 0, active: true });
      setEditing(null);
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  function edit(i: any) {
    setEditing(i.id);
    setForm({
      name: i.name,
      unitOfMeasure: i.unitOfMeasure,
      stock: Number(i.stock),
      minStock: Number(i.minStock),
      cost: Number(i.cost),
      active: i.active,
    });
  }

  async function remove(i: any) {
    if (!confirm(`Excluir ingrediente "${i.name}"?`)) return;
    try { await apiFetch(`/api/v1/admin/ingredients/${i.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { alert(e.message); }
  }

  async function adjustStock() {
    if (!stockModal) return;
    setBusy(true); setMsg(null);
    try {
      await apiFetch(`/api/v1/admin/ingredients/${stockModal.id}/stock`, {
        method: 'POST',
        body: JSON.stringify({
          delta: Number(stockDelta.replace(',', '.')),
          reason: stockReason || undefined,
        }),
      });
      setStockModal(null); setStockDelta(''); setStockReason('');
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">Ingredientes & Estoque</h1>

      <form onSubmit={save} className="card p-4 mb-5 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
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
          <label className="label">Estoque</label>
          <input className="input" type="number" step="0.001" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        </div>
        <div>
          <label className="label">Mínimo</label>
          <input className="input" type="number" step="0.001" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
        </div>
        <div>
          <label className="label">Custo/un</label>
          <input className="input" type="number" step="0.0001" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </div>
        <div className="md:col-span-6 flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativo
          </label>
          <button className="btn btn-primary" disabled={busy}>{editing ? 'Atualizar' : 'Cadastrar'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', unitOfMeasure: 'un', stock: 0, minStock: 0, cost: 0, active: true }); }} className="btn btn-ghost">Cancelar</button>}
          {msg && <span className="text-sm text-gray-300">{msg}</span>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Un</th>
              <th className="text-right p-3">Estoque</th>
              <th className="text-right p-3">Mínimo</th>
              <th className="text-right p-3">Custo</th>
              <th className="text-center p-3">Ativo</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 p-10">Nenhum ingrediente cadastrado</td></tr>}
            {list.map((i) => {
              const low = Number(i.stock) <= Number(i.minStock) && Number(i.minStock) > 0;
              return (
                <tr key={i.id} className="border-t border-gray-800">
                  <td className="p-3 font-medium">{i.name}</td>
                  <td className="p-3">{i.unitOfMeasure}</td>
                  <td className={`p-3 text-right ${low ? 'text-red-400 font-bold' : ''}`}>{Number(i.stock).toString().replace('.', ',')}</td>
                  <td className="p-3 text-right text-gray-500">{Number(i.minStock).toString().replace('.', ',')}</td>
                  <td className="p-3 text-right">{formatBRL(i.cost)}</td>
                  <td className="p-3 text-center">{i.active ? '✅' : '⛔'}</td>
                  <td className="p-3 text-right space-x-2">
                    <button onClick={() => setStockModal(i)} className="text-xs text-brand-400 hover:underline">Ajustar estoque</button>
                    <button onClick={() => edit(i)} className="text-xs text-blue-400 hover:underline">Editar</button>
                    <button onClick={() => remove(i)} className="text-xs text-red-400 hover:underline">Excluir</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stockModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-md space-y-3">
            <div className="text-lg font-semibold">Ajustar estoque · {stockModal.name}</div>
            <div className="text-sm text-gray-400">Atual: <b>{Number(stockModal.stock).toString().replace('.', ',')} {stockModal.unitOfMeasure}</b></div>
            <div>
              <label className="label">Delta (use negativo para saída)</label>
              <input className="input" value={stockDelta} onChange={(e) => setStockDelta(e.target.value)} placeholder="Ex: 10 ou -2,5" />
            </div>
            <div>
              <label className="label">Motivo (opcional)</label>
              <input className="input" value={stockReason} onChange={(e) => setStockReason(e.target.value)} placeholder="Compra, perda, inventário..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStockModal(null)} className="btn btn-ghost">Cancelar</button>
              <button onClick={adjustStock} disabled={busy || !stockDelta} className="btn btn-primary">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
