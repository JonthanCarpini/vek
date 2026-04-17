'use client';
import { useState } from 'react';
import { formatBRL } from '@/lib/format';
import { PAYMENT_HINTS } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (paymentHint: string, splitCount?: number) => Promise<void>;
  total: number;
  enabledMethods: string[];
  primaryColor: string;
};

export function BillRequestModal({ open, onClose, onConfirm, total, enabledMethods, primaryColor }: Props) {
  const [method, setMethod] = useState<string | null>(null);
  const [splitN, setSplitN] = useState(2);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const methods = PAYMENT_HINTS.filter((h) => h.id === 'split' || enabledMethods.includes(h.id));

  async function submit() {
    if (!method) return;
    setBusy(true);
    try { await onConfirm(method, method === 'split' ? splitN : undefined); setMethod(null); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div className="bg-[color:var(--card)] w-full rounded-t-3xl max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xl font-bold">💳 Pedir a conta</div>
            <div className="text-xs text-gray-400">Como você quer pagar?</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        <div className="bg-[#1f1f2b] rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-gray-400">Total da mesa</div>
          <div className="text-3xl font-bold" style={{ color: primaryColor }}>{formatBRL(total)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {methods.map((m) => {
            const active = method === m.id;
            return (
              <button key={m.id} onClick={() => setMethod(m.id)}
                className={`p-3 rounded-xl border text-center transition ${active ? 'border-transparent text-white' : 'border-[color:var(--border)] hover:border-gray-500'}`}
                style={active ? { backgroundColor: primaryColor } : undefined}>
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className="font-semibold text-sm">{m.label}</div>
              </button>
            );
          })}
        </div>

        {method === 'split' && (
          <div className="bg-[#1f1f2b] rounded-xl p-4 mb-4">
            <div className="text-sm mb-2">Dividir em quantas pessoas?</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSplitN((n) => Math.max(2, n - 1))}
                className="w-10 h-10 rounded-full bg-[#0b0b0f] text-xl">−</button>
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold">{splitN}</div>
                <div className="text-xs text-gray-400">{formatBRL(total / splitN)} por pessoa</div>
              </div>
              <button onClick={() => setSplitN((n) => Math.min(20, n + 1))}
                className="w-10 h-10 rounded-full bg-[#0b0b0f] text-xl">+</button>
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!method || busy}
          className="w-full btn btn-primary py-3"
          style={{ backgroundColor: primaryColor }}
        >
          {busy ? 'Enviando...' : 'Chamar garçom para fechar a conta'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          O garçom irá à sua mesa com a maquininha/informações de pagamento.
        </p>
      </div>
    </div>
  );
}
