'use client';

import { useEffect, useState } from 'react';
import { Bell, RefreshCw, Copy, Check, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/staff-client';

/**
 * Card de configuração Web Push (VAPID) para a unit.
 * Permite gerar um novo par de chaves ou colar manualmente.
 * A private key nunca é exibida após salva (write-only).
 */
export default function PushConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{
    publicKey: string | null;
    subject: string | null;
    configured: boolean;
    subscriptions: number;
  } | null>(null);

  // Form manual
  const [form, setForm] = useState({ publicKey: '', privateKey: '', subject: '' });
  const [manualMode, setManualMode] = useState(false);

  // Gerador rápido
  const [genSubject, setGenSubject] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const body = await apiFetch('/api/v1/admin/delivery/push-config');
      setData(body);
      setGenSubject((prev) => prev || body.subject || '');
    } catch (e: any) {
      setToast(e.message || 'Erro ao carregar');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(genSubject) && !/^https:\/\/\S+$/.test(genSubject)) {
      setToast('Subject inválido: use mailto:email@dominio.com ou https://seusite.com');
      setTimeout(() => setToast(null), 4000);
      return;
    }
    if (data?.configured && !confirm(
      'Já existe uma chave VAPID. Gerar uma nova invalidará todas as subscriptions existentes dos clientes. Continuar?',
    )) return;
    setBusy(true);
    try {
      await apiFetch('/api/v1/admin/delivery/push-config', {
        method: 'POST',
        body: JSON.stringify({ subject: genSubject }),
      });
      setToast('✅ Chaves geradas com sucesso');
      await load();
    } catch (e: any) {
      setToast(e.message || 'Erro ao gerar');
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleManualSave = async () => {
    if (!form.publicKey || !form.privateKey || !form.subject) {
      setToast('Preencha todos os campos'); return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/v1/admin/delivery/push-config', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setToast('✅ Chaves salvas');
      setForm({ publicKey: '', privateKey: '', subject: '' });
      setManualMode(false);
      await load();
    } catch (e: any) {
      setToast(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleCopy = async () => {
    if (!data?.publicKey) return;
    await navigator.clipboard.writeText(data.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <section className="card p-5 text-gray-400">Carregando push config...</section>;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-400" />
          <h2 className="font-bold text-lg">Notificações Push (Web Push / VAPID)</h2>
        </div>
        {data?.configured && (
          <span className="badge badge-ok">Ativo</span>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Permite enviar notificações para clientes mesmo com o app fechado (Android/desktop). Gere um par
        de chaves VAPID ou cole as suas. A <strong>private key</strong> é armazenada apenas no servidor.
      </p>

      {data?.configured && (
        <div className="mb-4 p-3 rounded-lg bg-black/20 border border-[var(--border)] text-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-400">Subject:</span>
            <span className="font-mono text-xs truncate">{data.subject}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 whitespace-nowrap">Public key:</span>
            <span className="font-mono text-xs break-all flex-1">{data.publicKey}</span>
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-white/5 rounded"
              title="Copiar"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
              {data.subject && !/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.subject) && !/^https:\/\/\S+$/.test(data.subject) && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
              ⚠️ Subject inválido — as notificações não serão enviadas. Gere novas chaves com um e-mail válido abaixo.
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-[var(--border)]">
            <span>Devices inscritos:</span>
            <span className="font-semibold text-gray-200">{data.subscriptions}</span>
          </div>
        </div>
      )}

      {/* Gerador automático */}
      <div className="p-3 rounded-lg bg-black/20 border border-[var(--border)] space-y-3">
        <label className="label">Contato (email ou URL)</label>
        <input
          type="text"
          value={genSubject}
          onChange={(e) => setGenSubject(e.target.value)}
          placeholder="mailto:contato@suadelivery.com"
          className="input"
        />
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {busy
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><RefreshCw className="w-4 h-4 mr-2" /> {data?.configured ? 'Gerar novas chaves' : 'Gerar chaves VAPID'}</>}
        </button>
        <p className="text-xs text-gray-500">
          Ao gerar novas chaves, todas as subscriptions existentes dos clientes deixarão de funcionar até que reativem a notificação.
        </p>
      </div>

      {/* Modo manual */}
      <div className="mt-3">
        <button
          onClick={() => setManualMode((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          {manualMode ? '↑ Ocultar modo manual' : '↓ Colar chaves manualmente (avançado)'}
        </button>
      </div>

      {manualMode && (
        <div className="mt-3 p-3 rounded-lg bg-black/20 border border-[var(--border)] space-y-3">
          <div>
            <label className="label">Subject (mailto: ou https://)</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="mailto:seuemail@dominio.com"
              className="input"
            />
          </div>
          <div>
            <label className="label">VAPID Public Key</label>
            <input
              type="text"
              value={form.publicKey}
              onChange={(e) => setForm({ ...form, publicKey: e.target.value })}
              placeholder="BN..."
              className="input font-mono text-xs"
            />
          </div>
          <div>
            <label className="label">VAPID Private Key</label>
            <input
              type="password"
              value={form.privateKey}
              onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
              placeholder="chave privada base64url"
              className="input font-mono text-xs"
            />
          </div>
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar chaves'}
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </section>
  );
}
