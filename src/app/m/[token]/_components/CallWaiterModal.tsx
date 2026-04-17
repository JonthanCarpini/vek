'use client';
import { useState } from 'react';
import { WAITER_REASONS } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  primaryColor: string;
};

export function CallWaiterModal({ open, onClose, onConfirm, primaryColor }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function reset() { setSelected(null); setCustom(''); }

  async function submit() {
    const preset = WAITER_REASONS.find((r) => r.id === selected);
    const text = selected === 'other' ? custom.trim() : (preset?.text || '');
    if (selected === 'other' && !text) return;
    setBusy(true);
    try { await onConfirm(text); reset(); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div className="bg-[color:var(--card)] w-full rounded-t-3xl max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xl font-bold">🙋 Chamar garçom</div>
            <div className="text-xs text-gray-400">Selecione o motivo para agilizar o atendimento</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {WAITER_REASONS.map((r) => {
            const active = selected === r.id;
            return (
              <button key={r.id} onClick={() => setSelected(r.id)}
                className={`p-3 rounded-xl border text-left text-sm transition ${active ? 'border-transparent text-white' : 'border-[color:var(--border)] hover:border-gray-500'}`}
                style={active ? { backgroundColor: primaryColor } : undefined}>
                <div className="font-semibold">{r.label}</div>
              </button>
            );
          })}
        </div>

        {selected === 'other' && (
          <textarea
            autoFocus
            className="input min-h-[80px] resize-none mb-4"
            placeholder="Descreva o que precisa..."
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={300}
          />
        )}

        <button
          onClick={submit}
          disabled={!selected || (selected === 'other' && !custom.trim()) || busy}
          className="w-full btn btn-primary py-3"
          style={{ backgroundColor: primaryColor }}
        >
          {busy ? 'Chamando...' : 'Chamar garçom'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          Um funcionário irá à sua mesa assim que possível.
        </p>
      </div>
    </div>
  );
}
