'use client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';
import { ImageUpload } from '@/components/ImageUpload';
import { formatBRL } from '@/lib/format';

function VideoUploadInline({ value, onChange }: { value: string; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true); setErr(null);
    try {
      const a = loadStaff();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'video');
      const r = await fetch('/api/v1/admin/upload', {
        method: 'POST',
        headers: a?.token ? { Authorization: `Bearer ${a.token}` } : {},
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      onChange(j.data.url);
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-3 border border-brand-600/30 rounded-lg p-3 bg-brand-600/5">
      <label className="label">🎬 Vídeo promocional (opcional, MP4/WebM até 50 MB)</label>
      {value && (
        <video src={value} controls className="w-full max-h-48 rounded mb-2 bg-black" />
      )}
      <div className="flex gap-2">
        <input ref={ref} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ''; }} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn btn-ghost text-sm">
          {busy ? 'Enviando...' : value ? 'Trocar vídeo' : 'Enviar vídeo'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="btn btn-ghost text-sm text-red-400">Remover</button>
        )}
      </div>
      {err && <div className="text-xs text-red-400 mt-1">{err}</div>}
    </div>
  );
}

const EMPTY = { categoryId: '', name: '', description: '', price: 0, imageUrl: '', available: true, active: true, preparationTimeMin: 15, station: 'cozinha', featured: false, videoUrl: '', ingredients: [] as any[] };

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [filterCat, filterStatus]);
  async function load() {
    try {
      const qs = new URLSearchParams();
      if (filterCat) qs.set('categoryId', filterCat);
      if (filterStatus === 'active') qs.set('active', 'true');
      if (filterStatus === 'archived') qs.set('active', 'false');
      const q = qs.toString() ? `?${qs}` : '';
      const [p, c, ing] = await Promise.all([
        apiFetch(`/api/v1/admin/products${q}`),
        apiFetch('/api/v1/admin/categories'),
        apiFetch('/api/v1/admin/ingredients').catch(() => ({ ingredients: [] })),
      ]);
      setProducts(p.products); setCats(c.categories); setIngredients(ing.ingredients || []);
    } catch {}
  }

  function addIngredient() {
    const available = ingredients.filter((i) => !form.ingredients.some((x: any) => x.ingredientId === i.id));
    if (available.length === 0) return;
    setForm({ ...form, ingredients: [...form.ingredients, { ingredientId: available[0].id, quantity: 1, optional: false }] });
  }
  function updateIngredient(idx: number, patch: any) {
    setForm({ ...form, ingredients: form.ingredients.map((x: any, i: number) => i === idx ? { ...x, ...patch } : x) });
  }
  function removeIngredient(idx: number) {
    setForm({ ...form, ingredients: form.ingredients.filter((_: any, i: number) => i !== idx) });
  }

  const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body: any = { ...form, price: Number(form.price), preparationTimeMin: Number(form.preparationTimeMin) };
      if (!body.imageUrl) delete body.imageUrl;
      if (!body.description) delete body.description;
      if (!body.videoUrl) delete body.videoUrl;
      body.ingredients = (form.ingredients || []).map((i: any) => ({
        ingredientId: i.ingredientId, quantity: Number(i.quantity) || 0, optional: !!i.optional,
      })).filter((i: any) => i.ingredientId && i.quantity > 0);
      if (editing) await apiFetch(`/api/v1/admin/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/api/v1/admin/products', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false); setEditing(null); setForm(EMPTY); load();
    } catch (e: any) { alert(e.message); }
  }
  function openEdit(p: any) {
    setEditing(p);
    setForm({
      categoryId: p.categoryId, name: p.name, description: p.description || '', price: Number(p.price),
      imageUrl: p.imageUrl || '', available: p.available, active: p.active,
      preparationTimeMin: p.preparationTimeMin, station: p.station,
      featured: !!p.featured, videoUrl: p.videoUrl || '',
      ingredients: (p.ingredients || []).map((pi: any) => ({
        ingredientId: pi.ingredientId, quantity: Number(pi.quantity), optional: !!pi.optional,
      })),
    });
    setOpen(true);
  }
  async function archive(id: string) {
    if (!confirm('Arquivar?')) return;
    try { await apiFetch(`/api/v1/admin/products/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} className="btn btn-primary">+ Novo</button>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">Buscar</label>
          <input className="input" placeholder="Nome do produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label className="label">Categoria</label>
          <select className="input" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Todas</option>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="label">Status</label>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
            <option value="active">Ativos</option>
            <option value="archived">Arquivados</option>
            <option value="all">Todos</option>
          </select>
        </div>
        <div className="text-sm text-gray-400 ml-auto">{filtered.length} produto(s)</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((p: any) => (
          <div key={p.id} className="card p-3 flex gap-3">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-20 h-20 rounded object-cover" /> : <div className="w-20 h-20 bg-[#1f1f2b] rounded" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-gray-400">{p.category?.name}</div>
              <div className="text-brand-500 font-bold">{formatBRL(p.price)}</div>
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
            <div className="mt-3 mb-3">
              <ImageUpload
                label="Imagem do produto"
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url || '' })}
              />
            </div>
            <label className="label">Estação</label>
            <select className="input mb-3" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
              <option value="cozinha">Cozinha</option><option value="bar">Bar</option><option value="grill">Grill</option>
            </select>
            <div className="flex gap-4 mb-3 flex-wrap">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Disponível</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> ⭐ Destaque (Painel TV)</label>
            </div>
            {form.featured && (
              <VideoUploadInline
                value={form.videoUrl}
                onChange={(url) => setForm({ ...form, videoUrl: url || '' })}
              />
            )}

            <div className="mb-3 border border-gray-800 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <label className="label !mb-0">🥬 Ingredientes</label>
                <button type="button" onClick={addIngredient} disabled={ingredients.length === 0 || form.ingredients.length >= ingredients.length} className="btn btn-ghost text-xs">+ Adicionar</button>
              </div>
              {ingredients.length === 0 && <div className="text-xs text-gray-500">Nenhum ingrediente cadastrado. Cadastre em "Ingredientes" no menu.</div>}
              {form.ingredients.length === 0 && ingredients.length > 0 && <div className="text-xs text-gray-500">Sem ingredientes vinculados.</div>}
              <div className="space-y-2">
                {form.ingredients.map((it: any, idx: number) => {
                  const ing = ingredients.find((i) => i.id === it.ingredientId);
                  return (
                    <div key={idx} className="flex gap-2 items-center">
                      <select className="input flex-1" value={it.ingredientId} onChange={(e) => updateIngredient(idx, { ingredientId: e.target.value })}>
                        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unitOfMeasure})</option>)}
                      </select>
                      <input type="number" step="0.001" className="input w-24" value={it.quantity} onChange={(e) => updateIngredient(idx, { quantity: e.target.value })} />
                      <span className="text-xs text-gray-500 w-8">{ing?.unitOfMeasure || ''}</span>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={it.optional} onChange={(e) => updateIngredient(idx, { optional: e.target.checked })} /> opc.</label>
                      <button type="button" onClick={() => removeIngredient(idx)} className="text-red-400 text-xs">✕</button>
                    </div>
                  );
                })}
              </div>
            </div>

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
