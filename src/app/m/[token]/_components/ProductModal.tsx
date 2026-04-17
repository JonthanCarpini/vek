'use client';
import { useEffect, useState } from 'react';
import { formatBRL } from '@/lib/format';
import type { Product } from './types';

type Props = {
  product: Product | null;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, notes: string) => void;
  primaryColor: string;
};

export function ProductModal({ product, onClose, onAdd, primaryColor }: Props) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => { setQty(1); setNotes(''); }, [product?.id]);

  if (!product) return null;

  const total = product.price * qty;
  const canAdd = product.available && qty > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div
        className="bg-[color:var(--card)] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {product.imageUrl ? (
          <div className="relative h-56 sm:h-64 bg-[#1f1f2b]">
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            <button onClick={onClose}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white text-xl">✕</button>
          </div>
        ) : (
          <div className="relative h-40 bg-gradient-to-br from-[#1f1f2b] to-[#0b0b0f] flex items-center justify-center text-6xl">
            🍽️
            <button onClick={onClose}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white text-xl">✕</button>
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">{product.name}</h2>
              {product.preparationTimeMin > 0 && (
                <div className="text-xs text-gray-400 mt-1">⏱ ~{product.preparationTimeMin} min</div>
              )}
            </div>
            <div className="text-2xl font-bold" style={{ color: primaryColor }}>
              {formatBRL(product.price)}
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-gray-300 mt-3 leading-relaxed">{product.description}</p>
          )}

          {product.ingredients && product.ingredients.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ingredientes</div>
              <div className="flex flex-wrap gap-1.5">
                {product.ingredients.map((ing) => (
                  <span key={ing} className="text-xs px-2 py-1 rounded-lg bg-gray-500/10 text-gray-300 border border-gray-500/20">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {product.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#1f1f2b] text-gray-300">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5">
            <label className="label">Observações (opcional)</label>
            <textarea
              className="input min-h-[70px] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="Ex.: sem cebola, ponto da carne..."
            />
            <div className="text-xs text-gray-500 text-right">{notes.length}/200</div>
          </div>

          {!product.available && (
            <div className="mt-3 bg-red-600/20 border border-red-600/40 rounded-lg p-3 text-sm text-red-300">
              Este item está indisponível no momento.
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[color:var(--card)] border-t border-[color:var(--border)] p-4 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1f1f2b] rounded-full p-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full bg-[#0b0b0f] flex items-center justify-center text-xl" aria-label="Diminuir">
              −
            </button>
            <span className="min-w-[28px] text-center font-bold text-lg">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="w-9 h-9 rounded-full bg-[#0b0b0f] flex items-center justify-center text-xl" aria-label="Aumentar">
              +
            </button>
          </div>
          <button
            disabled={!canAdd}
            onClick={() => { onAdd(product, qty, notes); onClose(); }}
            className="flex-1 btn btn-primary text-base"
            style={{ backgroundColor: primaryColor }}
          >
            Adicionar • {formatBRL(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
