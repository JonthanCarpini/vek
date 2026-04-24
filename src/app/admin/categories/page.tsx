'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { GripVertical, ChevronUp, ChevronDown, Pencil, Trash2, PauseCircle, PlayCircle, Plus } from 'lucide-react';

export default function Categories() {
  const [cats, setCats] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const d = await apiFetch('/api/v1/admin/categories');
      setCats(d.categories);
    } catch {}
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/api/v1/admin/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
      } else {
        const maxOrder = cats.length ? Math.max(...cats.map((c) => c.sortOrder ?? 0)) : -1;
        await apiFetch('/api/v1/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name, sortOrder: maxOrder + 1 }),
        });
      }
      setName(''); setEditing(null); load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Remover/arquivar esta categoria?')) return;
    try { await apiFetch(`/api/v1/admin/categories/${id}`, { method: 'DELETE' }); load(); }
    catch (e: any) { alert(e.message); }
  }

  async function toggleActive(cat: any) {
    try {
      await apiFetch(`/api/v1/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !cat.active }),
      });
      load();
    } catch (e: any) { alert(e.message); }
  }

  async function moveOrder(cat: any, direction: 'up' | 'down') {
    const sorted = [...cats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    // Troca sortOrder entre os dois
    await Promise.all([
      apiFetch(`/api/v1/admin/categories/${cat.id}`, {
        method: 'PUT', body: JSON.stringify({ sortOrder: other.sortOrder ?? swapIdx }),
      }),
      apiFetch(`/api/v1/admin/categories/${other.id}`, {
        method: 'PUT', body: JSON.stringify({ sortOrder: cat.sortOrder ?? idx }),
      }),
    ]).catch((e: any) => alert(e.message));
    load();
  }

  async function setSortOrder(cat: any, val: string) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    try {
      await apiFetch(`/api/v1/admin/categories/${cat.id}`, {
        method: 'PUT', body: JSON.stringify({ sortOrder: n }),
      });
      load();
    } catch (e: any) { alert(e.message); }
  }

  const sorted = [...cats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <p className="text-sm text-gray-400">{cats.length} categorias</p>
      </div>

      {/* Formulário */}
      <form onSubmit={save} className="card p-4 mb-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="label text-xs">{editing ? 'Editando' : 'Nova categoria'}</label>
          <input
            className="input"
            placeholder="Nome da categoria"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary flex items-center gap-1.5" disabled={busy}>
          <Plus className="w-4 h-4" />
          {editing ? 'Salvar' : 'Adicionar'}
        </button>
        {editing && (
          <button type="button" onClick={() => { setEditing(null); setName(''); }} className="btn btn-ghost">
            Cancelar
          </button>
        )}
      </form>

      {/* Lista */}
      <div className="space-y-2">
        {sorted.map((c: any, idx) => (
          <div
            key={c.id}
            className={`card p-3 flex items-center gap-3 ${!c.active ? 'opacity-60' : ''}`}
          >
            {/* Drag handle visual */}
            <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0 cursor-grab" />

            {/* Up/Down */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveOrder(c, 'up')}
                disabled={idx === 0}
                className="p-0.5 text-gray-500 hover:text-gray-200 disabled:opacity-20"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveOrder(c, 'down')}
                disabled={idx === sorted.length - 1}
                className="p-0.5 text-gray-500 hover:text-gray-200 disabled:opacity-20"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Ordem numérica */}
            <input
              type="number"
              defaultValue={c.sortOrder ?? idx}
              key={`${c.id}-${c.sortOrder}`}
              onBlur={(e) => setSortOrder(c, e.target.value)}
              className="w-12 text-center input py-1 text-xs"
              title="Ordem de exibição"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${!c.active ? 'line-through text-gray-500' : ''}`}>{c.name}</span>
                {!c.active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                    Pausada
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                <span>{c._count?.products ?? 0} produto(s)</span>
                <span className="text-gray-700">·</span>
                <span className="font-mono text-gray-600" title={c.id}>{c.id.slice(0, 8)}…</span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => toggleActive(c)}
                title={c.active ? 'Pausar categoria (oculta do cardápio)' : 'Reativar categoria'}
                className={`p-2 rounded-lg transition ${c.active ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
              >
                {c.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setEditing(c); setName(c.name); }}
                className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition"
                title="Editar nome"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(c.id)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {cats.length === 0 && (
          <div className="card p-10 text-center text-gray-500">Nenhuma categoria cadastrada</div>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-3">
        Use as setas ou edite o número de ordem. Categorias pausadas ficam ocultas no cardápio do cliente.
      </p>
    </div>
  );
}
