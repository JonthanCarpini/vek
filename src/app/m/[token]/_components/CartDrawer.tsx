'use client';
import { useState } from 'react';
import { formatBRL } from '@/lib/format';
import type { CartItem } from './types';

type Props = {
  cart: CartItem[];
  open: boolean;
  onClose: () => void;
  onChangeQty: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onEditNotes: (productId: string, notes: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitting: boolean;
  primaryColor: string;
};

export function CartDrawer({
  cart, open, onClose, onChangeQty, onRemove, onEditNotes, onClear, onSubmit, submitting, primaryColor,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);

  if (!open) return null;

  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const count = cart.reduce((s, x) => s + x.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div
        className="bg-[color:var(--card)] w-full rounded-t-3xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
          <div>
            <div className="text-lg font-bold">🛒 Seu carrinho</div>
            <div className="text-xs text-gray-400">{count} item(ns) • ainda não enviados</div>
          </div>
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={() => { if (confirm('Esvaziar carrinho?')) onClear(); }}
                className="text-xs text-red-400 hover:underline">Limpar</button>
            )}
            <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-400 gap-3">
            <div className="text-6xl">🛒</div>
            <div>Seu carrinho está vazio</div>
            <button onClick={onClose} className="btn btn-ghost text-sm">Voltar ao cardápio</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="card p-3">
                  <div className="flex gap-3 items-start">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-[#1f1f2b] flex items-center justify-center flex-shrink-0 text-2xl">🍽️</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-gray-400">{formatBRL(item.price)} cada</div>
                      {item.notes && editingNotes !== item.productId && (
                        <div className="text-xs text-amber-400 mt-1 italic">📝 {item.notes}</div>
                      )}
                      {editingNotes === item.productId ? (
                        <div className="mt-2">
                          <textarea
                            autoFocus
                            className="input text-sm min-h-[60px] resize-none"
                            defaultValue={item.notes || ''}
                            onBlur={(e) => { onEditNotes(item.productId, e.target.value); setEditingNotes(null); }}
                            maxLength={200}
                          />
                        </div>
                      ) : (
                        <button onClick={() => setEditingNotes(item.productId)}
                          className="text-xs text-brand-500 hover:underline mt-1">
                          {item.notes ? 'Editar observação' : '+ Adicionar observação'}
                        </button>
                      )}
                    </div>
                    <button onClick={() => onRemove(item.productId)}
                      className="text-gray-500 hover:text-red-400 text-lg" aria-label="Remover">🗑</button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 bg-[#1f1f2b] rounded-full p-1">
                      <button onClick={() => onChangeQty(item.productId, -1)}
                        className="w-8 h-8 rounded-full bg-[#0b0b0f] flex items-center justify-center">−</button>
                      <span className="min-w-[24px] text-center font-bold">{item.quantity}</span>
                      <button onClick={() => onChangeQty(item.productId, 1)}
                        className="w-8 h-8 rounded-full bg-[#0b0b0f] flex items-center justify-center">+</button>
                    </div>
                    <div className="font-bold">{formatBRL(item.price * item.quantity)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[color:var(--border)] p-4 space-y-3">
              <div className="flex justify-between text-lg">
                <span>Total deste pedido</span>
                <b style={{ color: primaryColor }}>{formatBRL(total)}</b>
              </div>
              {!confirming ? (
                <button onClick={() => setConfirming(true)}
                  className="w-full btn btn-primary text-base py-3"
                  style={{ backgroundColor: primaryColor }}>
                  Enviar pedido • {count} item(ns)
                </button>
              ) : (
                <div className="bg-[#1f1f2b] rounded-xl p-3 space-y-2">
                  <div className="text-sm text-center">
                    Confirma o envio deste pedido para a cozinha?
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(false)} disabled={submitting}
                      className="flex-1 btn btn-ghost">Revisar</button>
                    <button onClick={() => { onSubmit(); setConfirming(false); }} disabled={submitting}
                      className="flex-1 btn btn-primary"
                      style={{ backgroundColor: primaryColor }}>
                      {submitting ? 'Enviando...' : '✓ Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
