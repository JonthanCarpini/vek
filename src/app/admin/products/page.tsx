'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

const EMPTY = { categoryId: '', name: '', description: '', price: 0, imageUrl: '', available: true, active: true, preparationTimeMin: 15, station: 'cozinha' };

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const [p, c] = await Promise.all([apiFetch('/api/v1/admin/products'), apiFetch('/api/v1/admin/categories')]);
      setProducts(p.products); setCats(c.categories);
    } catch {}
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body: any = { ...form, price: Number(form.price), preparationTimeMin: Number(form.preparationTimeMin) };
      if (!body.imageUrl) delete body.imageUrl; if (!body.description) delete body.description;
      if (editing) await apiFetch(`/api/v1/admin/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/api/v1/admin/products', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false); setEditing(null); setForm(EMPTY); load();
    } catch (e: any) { alert(e.message); }
  }
  function openEdit(p: any) {
    setEditing(p);
    setForm({ categoryId: p.categoryId, name: p.name, description: p.description || '', price: Number(p.price), imageUrl: p.imageUrl || '', available: p.available, active: p.active, preparationTimeMin: p.preparationTimeMin, station: p.station });
    setOpen(true);
  }
  async function archive(id: string) {
    if (!confirm('Arquivar?')) return;
    try { await apiFetch(`/api/v1/admin/products/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} className="btn btn-primary">+ Novo</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {products.map((p: any) => (
          <div key={p.id} className="card p-3 flex gap-3">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-20 h-20 rounded object-cover" /> : <div className="w-20 h-20 bg-[#1f1f2b] rounded" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-gray-400">{p.category?.name}</div>
              <div className="text-brand-500 font-bold">R$ {Number(p.price).toFixed(2)}</div>
              <div className="text-xs text-gray-500">{p.available ? 'Disponível' : 'Indisponível'} • {p.station}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => openEdit(p)} className="btn btn-ghost text-xs">Editar</button>
              <button onClick={() => archive(p.id)} className="btn btn-ghost text-xs text-red-400">Arquivar</button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold mb-4">{editing ? 'Editar produto' : 'Novo produto'}</div>
            <label className="label">Categoria</label>
            <select className="input mb-3" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">—</option>
              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="label">Nome</label>
            <input className="input mb-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label className="label">Descrição</label>
            <textarea className="input mb-3" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Preço</label><input type="number" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
              <div><label className="label">Preparo (min)</label><input type="number" className="input" value={form.preparationTimeMin} onChange={(e) => setForm({ ...form, preparationTimeMin: e.target.value })} /></div>
            </div>
            <label className="label mt-3">URL da imagem</label>
            <input className="input mb-3" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <label className="label">Estação</label>
            <select className="input mb-3" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
              <option value="cozinha">Cozinha</option><option value="bar">Bar</option><option value="grill">Grill</option>
            </select>
            <label className="flex items-center gap-2 mb-3"><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Disponível</label>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1">Salvar</button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
