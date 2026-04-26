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

const EMPTY = {
  categoryId: '', name: '', description: '', price: 0, imageUrl: '',
  available: true, active: true, preparationTimeMin: 15, station: 'cozinha',
  featured: false, videoUrl: '', stockCount: null as number | null,
};

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [stockBusy, setStockBusy] = useState<Record<string, boolean>>({});
  const [stockEntry, setStockEntry] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [filterCat, filterStatus]);

  async function load() {
    try {
      const qs = new URLSearchParams();
      if (filterCat) qs.set('categoryId', filterCat);
      if (filterStatus === 'active') qs.set('active', 'true');
      if (filterStatus === 'archived') qs.set('active', 'false');
      const q = qs.toString() ? `?${qs}` : '';
      const [p, c] = await Promise.all([
        apiFetch(`/api/v1/admin/products${q}`),
        apiFetch('/api/v1/admin/categories'),
      ]);
      setProducts(p.products); setCats(c.categories);
    } catch {}
  }

  const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: any = {
        ...form,
        price: Number(form.price),
        preparationTimeMin: Number(form.preparationTimeMin),
        stockCount: form.stockCount !== null && form.stockCount !== undefined ? Number(form.stockCount) : null,
      };
      if (!body.imageUrl) delete body.imageUrl;
      if (!body.description) delete body.description;
      if (!body.videoUrl) delete body.videoUrl;
      if (editing) await apiFetch(`/api/v1/admin/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/api/v1/admin/products', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false); setEditing(null); setForm(EMPTY); load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({
      categoryId: p.categoryId, name: p.name, description: p.description || '',
      price: Number(p.price), imageUrl: p.imageUrl || '', available: p.available,
      active: p.active, preparationTimeMin: p.preparationTimeMin, station: p.station,
      featured: !!p.featured, videoUrl: p.videoUrl || '',
      stockCount: p.stockCount !== null && p.stockCount !== undefined ? Number(p.stockCount) : null,
    });
    setOpen(true);
  }

  async function archive(id: string) {
    if (!confirm('Arquivar este produto? Ele não aparecerá mais no cardápio, mas continuará no histórico.')) return;
    try { await apiFetch(`/api/v1/admin/products/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  async function hardDelete(id: string) {
    if (!confirm('EXCLUIR PERMANENTEMENTE? Esta ação não pode ser desfeita e removerá o produto de todos os registros.')) return;
    try { await apiFetch(`/api/v1/admin/products/${id}?hard=true`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  async function toggleAvailable(p: any) {
    try {
      await apiFetch(`/api/v1/admin/products/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ available: !p.available }),
      });
      load();
    } catch (e: any) { alert(e.message); }
  }

  async function setStock(productId: string) {
    const val = stockEntry[productId];
    if (val === '' || val === undefined) return;
    const parsed = val === 'null' ? null : parseInt(val, 10);
    if (val !== 'null' && isNaN(parsed as number)) return;
    setStockBusy((b) => ({ ...b, [productId]: true }));
    try {
      await apiFetch(`/api/v1/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ stockCount: parsed }),
      });
      setStockEntry((e) => { const n = { ...e }; delete n[productId]; return n; });
      load();
    } catch (e: any) { alert(e.message); }
    finally { setStockBusy((b) => ({ ...b, [productId]: false })); }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((p: any) => {
          const stock = p.stockCount !== null && p.stockCount !== undefined ? Number(p.stockCount) : null;
          const entryVal = stockEntry[p.id] ?? '';

          return (
            <div key={p.id} className={`card p-4 flex gap-4 transition-all ${!p.available ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <div className="relative flex-shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-24 h-24 rounded-xl object-cover shadow-lg" />
                ) : (
                  <div className="w-24 h-24 bg-[#1f1f2b] rounded-xl flex items-center justify-center text-2xl">🍔</div>
                )}
                {!p.available && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center text-[10px] font-black text-white uppercase tracking-tighter">Pausado</div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-lg truncate leading-tight">{p.name}</div>
                    <div className="text-brand-500 font-black">{formatBRL(p.price)}</div>
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tight mb-1">{p.category?.name} • {p.station}</div>

                  {/* Stock display */}
                  <div className={`text-xs font-bold flex items-center gap-1 ${stock === null ? 'text-gray-500' : stock === 0 ? 'text-red-400' : stock <= 5 ? 'text-amber-400' : 'text-green-400'}`}>
                    <span className="opacity-60">Estoque:</span>
                    {stock === null ? 'Ilimitado' : stock === 0 ? 'Esgotado' : `${stock} un`}
                  </div>

                  {/* Inline stock adjustment */}
                  <div className="flex gap-1 mt-2">
                    <input
                      className="input h-7 text-xs flex-1 min-w-0"
                      placeholder={stock === null ? 'Ilimitado' : String(stock)}
                      value={entryVal}
                      onChange={(e) => setStockEntry((s) => ({ ...s, [p.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && setStock(p.id)}
                      type="number"
                      min="0"
                    />
                    <button
                      onClick={() => setStock(p.id)}
                      disabled={stockBusy[p.id] || entryVal === ''}
                      className="btn bg-brand-600/20 text-brand-400 text-[10px] px-2 h-7 font-black uppercase"
                    >
                      {stockBusy[p.id] ? '...' : 'Set'}
                    </button>
                    {stock !== null && (
                      <button
                        onClick={() => { setStockEntry((s) => ({ ...s, [p.id]: 'null' })); setTimeout(() => setStock(p.id), 0); }}
                        disabled={stockBusy[p.id]}
                        className="btn bg-gray-600/20 text-gray-400 text-[10px] px-2 h-7 font-black uppercase"
                        title="Remover limite (ilimitado)"
                      >
                        ∞
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button onClick={() => toggleAvailable(p)} className={`btn text-[10px] px-2 py-1 flex-1 font-black uppercase tracking-tighter ${p.available ? 'bg-amber-600/20 text-amber-400' : 'bg-green-600/20 text-green-400'}`}>
                    {p.available ? 'Pausar' : 'Ativar'}
                  </button>
                  <button onClick={() => openEdit(p)} className="btn bg-blue-600/10 text-blue-400 text-[10px] px-2 py-1 flex-1 font-black uppercase tracking-tighter">Editar</button>
                  <button
                    onClick={() => p.active ? archive(p.id) : hardDelete(p.id)}
                    className="btn bg-red-600/10 text-red-400 text-[10px] px-2 py-1 font-black uppercase tracking-tighter"
                    title={p.active ? 'Arquivar' : 'Excluir permanentemente'}
                  >
                    {p.active ? 'Arq' : 'Excl'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-stretch md:items-center justify-center p-0 md:p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save}
            className="bg-[#0b0b0f] border border-[color:var(--border)] w-full md:max-w-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-screen md:max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}>

            <header className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border)] sticky top-0 bg-[#0b0b0f] z-10">
              <div className="text-lg font-bold">{editing ? 'Editar produto' : 'Novo produto'}</div>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                  <div>
                    <label className="label">Categoria *</label>
                    <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                      <option value="">—</option>
                      {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Nome *</label>
                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Descrição</label>
                    <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Preço *</label>
                      <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value as any })} required />
                    </div>
                    <div>
                      <label className="label">Preparo (min)</label>
                      <input type="number" className="input" value={form.preparationTimeMin} onChange={(e) => setForm({ ...form, preparationTimeMin: e.target.value as any })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Estação</label>
                    <select className="input" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
                      <option value="cozinha">Cozinha</option>
                      <option value="bar">Bar</option>
                      <option value="grill">Grill</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Estoque inicial</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="0"
                        className="input flex-1"
                        placeholder="Deixe vazio para ilimitado"
                        value={form.stockCount === null || form.stockCount === undefined ? '' : form.stockCount}
                        onChange={(e) => setForm({ ...form, stockCount: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      {form.stockCount !== null && (
                        <button type="button" onClick={() => setForm({ ...form, stockCount: null })} className="btn btn-ghost text-xs px-2" title="Ilimitado">∞</button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Vazio = ilimitado. Defina 0 para marcar como esgotado.</p>
                  </div>
                  <div className="flex gap-4 flex-wrap pt-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
                      Disponível
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                      ⭐ Destaque (Painel TV)
                    </label>
                  </div>
                </div>

                {/* Right column: media */}
                <div className="space-y-4">
                  <ImageUpload
                    label="Imagem do produto"
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url || '' })}
                  />
                  {form.featured && (
                    <VideoUploadInline
                      value={form.videoUrl}
                      onChange={(url) => setForm({ ...form, videoUrl: url || '' })}
                    />
                  )}
                </div>
              </div>
            </div>

            <footer className="flex gap-2 px-5 py-3 border-t border-[color:var(--border)] sticky bottom-0 bg-[#0b0b0f]">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
              <button className="btn btn-primary flex-1" disabled={busy}>{editing ? 'Atualizar' : 'Cadastrar'}</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
