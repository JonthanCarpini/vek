'use client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, loadStaff } from '@/lib/staff-client';

const EMPTY = { type: 'image', url: '', durationSec: 8, sortOrder: 0, active: true, title: '', subtitle: '' };

export default function DisplayItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    try { const d = await apiFetch('/api/v1/admin/display-items'); setItems(d.items || []); }
    catch {}
  }

  async function handleUpload(file: File) {
    setBusy(true); setErr(null);
    try {
      const staff = loadStaff();
      const isVideo = file.type.startsWith('video/');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', isVideo ? 'video' : 'image');
      const r = await fetch('/api/v1/admin/upload', {
        method: 'POST',
        headers: staff?.token ? { Authorization: `Bearer ${staff.token}` } : {},
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      setForm((f: any) => ({ ...f, url: j.data.url, type: isVideo ? 'video' : 'image' }));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, sortOrder: items.length });
    setOpen(true);
  }
  function openEdit(it: any) {
    setEditing(it);
    setForm({
      type: it.type, url: it.url, durationSec: it.durationSec, sortOrder: it.sortOrder,
      active: it.active, title: it.title || '', subtitle: it.subtitle || '',
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const body = {
        type: form.type,
        url: form.url,
        durationSec: Number(form.durationSec) || 8,
        sortOrder: Number(form.sortOrder) || 0,
        active: !!form.active,
        title: form.title || null,
        subtitle: form.subtitle || null,
      };
      if (editing) {
        await apiFetch(`/api/v1/admin/display-items/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/v1/admin/display-items', { method: 'POST', body: JSON.stringify(body) });
      }
      setOpen(false); setForm(EMPTY); setEditing(null);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function remove(it: any) {
    if (!confirm(`Excluir "${it.title || it.url}"?`)) return;
    try { await apiFetch(`/api/v1/admin/display-items/${it.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { alert(e.message); }
  }

  async function toggleActive(it: any) {
    try {
      await apiFetch(`/api/v1/admin/display-items/${it.id}`, {
        method: 'PUT', body: JSON.stringify({ active: !it.active }),
      });
      await load();
    } catch (e: any) { alert(e.message); }
  }

  async function move(it: any, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === it.id);
    const other = items[idx + dir];
    if (!other) return;
    try {
      await Promise.all([
        apiFetch(`/api/v1/admin/display-items/${it.id}`, { method: 'PUT', body: JSON.stringify({ sortOrder: other.sortOrder }) }),
        apiFetch(`/api/v1/admin/display-items/${other.id}`, { method: 'PUT', body: JSON.stringify({ sortOrder: it.sortOrder }) }),
      ]);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Painel TV — Playlist</h1>
          <p className="text-sm text-gray-400">Vídeos e imagens exibidos em sequência no painel do salão.</p>
        </div>
        <button onClick={openNew} className="btn btn-primary">+ Novo item</button>
      </div>

      {items.length === 0 && (
        <div className="card p-10 text-center text-gray-500">
          Nenhum item cadastrado ainda.<br />
          Clique em <b>+ Novo item</b> para subir um vídeo ou imagem promocional.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it, idx) => (
          <div key={it.id} className={`card overflow-hidden ${!it.active ? 'opacity-50' : ''}`}>
            <div className="aspect-video bg-black flex items-center justify-center">
              {it.type === 'video' ? (
                <video src={it.url} className="w-full h-full object-cover" muted loop />
              ) : (
                <img src={it.url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{it.title || `Item #${idx + 1}`}</div>
                  {it.subtitle && <div className="text-xs text-gray-400 truncate">{it.subtitle}</div>}
                  <div className="text-xs text-gray-500 mt-1">
                    {it.type === 'video' ? '🎬 Vídeo (duração total)' : `🖼️ Imagem · ${it.durationSec}s`}
                  </div>
                </div>
                <span className={`badge ${it.active ? 'badge-ok' : ''}`}>{it.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                <button onClick={() => move(it, -1)} disabled={idx === 0} className="btn btn-ghost text-xs">▲</button>
                <button onClick={() => move(it, 1)} disabled={idx === items.length - 1} className="btn btn-ghost text-xs">▼</button>
                <button onClick={() => toggleActive(it)} className="btn btn-ghost text-xs">{it.active ? 'Desativar' : 'Ativar'}</button>
                <button onClick={() => openEdit(it)} className="btn btn-ghost text-xs">Editar</button>
                <button onClick={() => remove(it)} className="btn btn-ghost text-xs text-red-400">Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} className="bg-[#0b0b0f] border border-[color:var(--border)] rounded-2xl w-full max-w-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <header className="flex justify-between items-center px-5 py-3 border-b border-[color:var(--border)]">
              <div className="text-lg font-bold">{editing ? 'Editar item' : 'Novo item'}</div>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </header>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div>
                <label className="label">Arquivo (imagem ou vídeo)</label>
                {form.url && (
                  <div className="mb-2 rounded overflow-hidden bg-black">
                    {form.type === 'video' ? (
                      <video src={form.url} controls className="w-full max-h-48" />
                    ) : (
                      <img src={form.url} alt="" className="w-full max-h-48 object-contain" />
                    )}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-ghost">
                  {busy ? 'Enviando...' : form.url ? 'Trocar arquivo' : 'Escolher arquivo'}
                </button>
              </div>

              <div>
                <label className="label">Título (opcional)</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Subtítulo (opcional)</label>
                <input className="input" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>
              {form.type === 'image' && (
                <div>
                  <label className="label">Tempo de exibição (segundos)</label>
                  <input type="number" min="1" max="120" className="input" value={form.durationSec}
                    onChange={(e) => setForm({ ...form, durationSec: e.target.value })} />
                  <p className="text-xs text-gray-500 mt-1">Vídeos são exibidos pela duração completa automaticamente.</p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Ativo (aparece no painel)
              </label>
              {err && <div className="text-sm text-red-400">{err}</div>}
            </div>
            <footer className="flex gap-2 px-5 py-3 border-t border-[color:var(--border)]">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
              <button disabled={busy || !form.url} className="btn btn-primary flex-1">{editing ? 'Atualizar' : 'Cadastrar'}</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
