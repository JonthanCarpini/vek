'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { Pencil, Trash2, PauseCircle, PlayCircle, Plus, ChevronUp, ChevronDown } from 'lucide-react';

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
    if (!confirm('Remover esta categoria?')) return;
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

  const sorted = [...cats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-gray-400 mt-0.5">{cats.length} categorias · exibidas na ordem abaixo</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={save} className="card p-4 mb-5 flex gap-2 items-end">
        <div className="flex-1">
          <label className="label text-xs">{editing ? `Editando: ${editing.name}` : 'Nova categoria'}</label>
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

      {/* List */}
      <div className="space-y-2">
        {sorted.map((c: any, idx) => (
          <div
            key={c.id}
            className={`card flex items-center gap-3 px-4 py-3 ${!c.active ? 'opacity-50' : ''}`}
          >
            {/* Order buttons */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => moveOrder(c, 'up')}
                disabled={idx === 0}
                className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveOrder(c, 'down')}
                disabled={idx === sorted.length - 1}
                className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Position number */}
            <span className="text-xs text-gray-600 w-5 text-center tabular-nums">{idx + 1}</span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <span className={`font-medium ${!c.active ? 'line-through text-gray-500' : ''}`}>{c.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{c._count?.products ?? 0} produto(s)</span>
                {!c.active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    Pausada
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => toggleActive(c)}
                title={c.active ? 'Pausar' : 'Reativar'}
                className={`p-2 rounded-lg transition ${c.active ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
              >
                {c.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setEditing(c); setName(c.name); }}
                className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition"
                title="Renomear"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(c.id)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                title="Excluir"
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
        Use ↑↓ para reordenar. Categorias pausadas ficam ocultas no cardápio do cliente.
      </p>
    </div>
  );
}
