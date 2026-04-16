'use client';
import { useRef, useState } from 'react';
import { loadStaff } from '@/lib/staff-client';

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, label = 'Imagem', className }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true); setErr(null);
    try {
      const a = loadStaff();
      const fd = new FormData();
      fd.append('file', file);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-lg border border-gray-700 bg-black/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {value ? (
            <img src={value} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-600 text-xs">sem imagem</span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => ref.current?.click()}
              disabled={busy}
              className="btn btn-ghost text-sm"
            >
              {busy ? 'Enviando...' : value ? 'Trocar' : 'Enviar imagem'}
            </button>
            {value && (
              <button type="button" onClick={() => onChange(null)} className="btn btn-ghost text-sm text-red-400">
                Remover
              </button>
            )}
          </div>
          {err && <span className="text-xs text-red-400">{err}</span>}
        </div>
      </div>
    </div>
  );
}
