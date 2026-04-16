'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';

const EMPTY = { name: '', email: '', password: '', role: 'waiter', active: true };
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Gerente', waiter: 'Garçom', kitchen: 'Cozinha', cashier: 'Caixa',
};

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() { try { const d = await apiFetch('/api/v1/admin/users'); setUsers(d.users); } catch {} }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { ...form };
      if (editing && !body.password) delete body.password;
      if (editing) await apiFetch(`/api/v1/admin/users/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false); setForm(EMPTY); setEditing(null); load();
    } catch (e: any) { alert(e.message); }
  }
  function openEdit(u: any) { setEditing(u); setForm({ ...u, password: '' }); setOpen(true); }
  async function archive(id: string) {
    if (!confirm('Desativar usuário?')) return;
    try { await apiFetch(`/api/v1/admin/users/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} className="btn btn-primary">+ Novo</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1f1f2b] text-left">
            <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Papel</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-t border-[color:var(--border)]">
                <td className="p-3">{u.name}</td>
                <td className="p-3 text-gray-400">{u.email}</td>
                <td className="p-3"><span className="badge">{ROLE_LABEL[u.role] || u.role}</span></td>
                <td className="p-3">{u.active ? '✅' : '❌'}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(u)} className="btn btn-ghost text-xs mr-2">Editar</button>
                  <button onClick={() => archive(u.id)} className="btn btn-ghost text-xs text-red-400">Desativar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold mb-4">{editing ? 'Editar usuário' : 'Novo usuário'}</div>
            <label className="label">Nome</label>
            <input className="input mb-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label className="label">E-mail</label>
            <input className="input mb-3" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <label className="label">Senha {editing && <span className="text-gray-500">(deixe em branco para manter)</span>}</label>
            <input className="input mb-3" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
            <label className="label">Papel</label>
            <select className="input mb-3" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-2 mb-4"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Ativo</label>
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
