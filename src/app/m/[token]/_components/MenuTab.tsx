'use client';
import { useMemo, useState } from 'react';
import { formatBRL } from '@/lib/format';
import type { Category, Product } from './types';

type Props = {
  categories: Category[];
  onSelectProduct: (p: Product) => void;
  primaryColor: string;
};

export function MenuTab({ categories, onSelectProduct, primaryColor }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id || null);
  const [query, setQuery] = useState('');

  // Filtro global (se tiver query, ignora categoria)
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const all: Product[] = [];
      for (const c of categories) {
        for (const p of c.products) {
          const hit = p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
          if (hit) all.push(p);
        }
      }
      return all;
    }
    const cat = categories.find((c) => c.id === activeCat) || categories[0];
    return cat?.products || [];
  }, [query, activeCat, categories]);

  // -- Swipe Logic --
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = categories.findIndex((c) => c.id === activeCat);
      if (isLeftSwipe && currentIndex < categories.length - 1) {
        setActiveCat(categories[currentIndex + 1].id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (isRightSwipe && currentIndex > 0) {
        setActiveCat(categories[currentIndex - 1].id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  if (categories.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="text-5xl mb-3">🍽️</div>
        <p>Cardápio ainda não está disponível.</p>
      </div>
    );
  }

  return (
    <div className="pb-28" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Busca */}
      <div className="sticky top-[64px] z-10 bg-[#0b0b0f]/95 backdrop-blur border-b border-gray-800 px-4 py-2">
        <div className="relative">
          <input
            className="input pl-10 bg-[#1f1f2b] border-gray-800"
            placeholder="Buscar no cardápio..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">✕</button>
          )}
        </div>
      </div>

      {/* Chips categorias — só aparece sem busca */}
      {!query && (
        <div className="sticky top-[116px] z-10 bg-[#0b0b0f]/95 backdrop-blur border-b border-gray-800 overflow-x-auto no-scrollbar px-3 py-2 scroll-smooth">
          <div className="flex gap-2">
            {categories.map((c) => {
              const active = activeCat === c.id;
              const isSelected = (activeCat === null && categories[0].id === c.id) || active;
              return (
                <button 
                  key={c.id} 
                  id={`cat-${c.id}`}
                  onClick={() => setActiveCat(c.id)}
                  className={`px-4 py-1.5 rounded-full whitespace-nowrap text-xs transition-all duration-300 border ${isSelected ? 'text-white font-black border-transparent shadow-lg' : 'bg-[#1f1f2b] text-gray-400 border-gray-800 hover:border-gray-700'}`}
                  style={isSelected ? { backgroundColor: primaryColor, boxShadow: `${primaryColor}33 0px 4px 12px` } : undefined}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista produtos */}
      <div className="p-4 space-y-3">
        {filteredProducts.length === 0 && query && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">🔍</div>
            Nenhum produto encontrado para "{query}"
          </div>
        )}
        {filteredProducts.map((p) => (
          <ProductRow key={p.id} product={p} onClick={() => onSelectProduct(p)} primaryColor={primaryColor} />
        ))}
      </div>
    </div>
  );
}

function ProductRow({ product, onClick, primaryColor }: { product: Product; onClick: () => void; primaryColor: string }) {
  return (
    <button
      onClick={onClick}
      disabled={!product.available}
      title={product.ingredients?.length ? `Ingredientes: ${product.ingredients.join(', ')}` : undefined}
      className="w-full card p-3 flex gap-3 text-left hover:border-gray-700 active:scale-[0.99] transition disabled:opacity-50"
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-[#1f1f2b] flex items-center justify-center text-2xl flex-shrink-0">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate text-white">{product.name}</div>
        {product.description && (
          <div className="text-xs text-gray-400 line-clamp-2 mt-0.5">{product.description}</div>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="font-bold text-base" style={{ color: primaryColor }}>
            {formatBRL(Number(product.price))}
          </span>
          {product.available ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1f1f2b] text-gray-400 border border-gray-800">
              Toque p/ pedir
            </span>
          ) : (
            <span className="text-xs text-red-400">Indisponível</span>
          )}
        </div>
      </div>
    </button>
  );
}
