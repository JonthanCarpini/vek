'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

export default function Categories() {
  const [cats, setCats] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { load(); }, []);
  async function load() { try { const d = await apiFetch('/api/v1/admin/categories'); setCats(d.categories); } catch {} }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await apiFetch(`/api/v1/admin/categories/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name }) });
      } else {
        await apiFetch('/api/v1/admin/categories', { method: 'POST', body: JSON.stringify({ name }) });
      }
      setName(''); setEditing(null); load();
    } catch (e: any) { alert(e.message); }
  }
  async function remove(id: string) {
    if (!confirm('Remover/arquivar esta categoria?')) return;
    try { await apiFetch(`/api/v1/admin/categories/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Categorias</h1>
      <form onSubmit={save} className="card p-4 mb-4 flex gap-2">
        <input className="input flex-1" placeholder="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn btn-primary">{editing ? 'Salvar' : 'Adicionar'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setName(''); }} className="btn btn-ghost">Cancelar</button>}
      </form>
      <div className="grid gap-2">
        {cats.map((c: any) => (
          <div key={c.id} className="card p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-gray-500">{c._count?.products ?? 0} produto(s)</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(c); setName(c.name); }} className="btn btn-ghost text-sm">Editar</button>
              <button onClick={() => remove(c.id)} className="btn btn-ghost text-sm text-red-400">Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
