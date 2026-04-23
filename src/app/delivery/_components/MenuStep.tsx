'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Search, Plus, ShoppingCart } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { formatBRL } from '../_lib/api';

export default function MenuStep({ onOpenCart }: { onOpenCart: () => void }) {
  const { menu, addToCart, cartCount, unit } = useDelivery();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    if (!menu?.categories) return [];
    const q = search.trim().toLowerCase();
    return menu.categories
      .map((c: any) => ({
        ...c,
        products: c.products.filter((p: any) => {
          if (!q) return true;
          return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
        }),
      }))
      .filter((c: any) => c.products.length > 0);
  }, [menu, search]);

  const isOpen = unit?.state?.isOpen ?? true;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
            />
          </div>
          {/* Category pills */}
          {filteredCategories.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                  !activeCategory ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Todos
              </button>
              {filteredCategories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCategory(c.id);
                    const el = document.getElementById(`cat-${c.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                    activeCategory === c.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Closed banner */}
      {!isOpen && (
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
            ⚠️ A loja está fechada no momento. Você pode visualizar o cardápio mas não é possível fazer pedidos.
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {search ? 'Nenhum item encontrado' : 'Cardápio indisponível'}
          </div>
        ) : (
          filteredCategories.map((c: any) => (
            <section key={c.id} id={`cat-${c.id}`} className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">{c.name}</h2>
              <div className="space-y-3">
                {c.products.map((p: any) => (
                  <div
                    key={p.id}
                    className={`bg-white rounded-xl shadow-sm p-3 flex gap-3 ${
                      !p.available ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate">{p.name}</h3>
                      {p.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-orange-600">
                          {formatBRL(p.price)}
                        </span>
                        <button
                          disabled={!p.available || !isOpen}
                          onClick={() =>
                            addToCart({
                              productId: p.id, name: p.name, price: p.price, quantity: 1,
                              imageUrl: p.imageUrl,
                            })
                          }
                          className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-full p-2 transition"
                          aria-label="Adicionar"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {p.imageUrl && (
                      <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-20 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg py-3 px-4 flex items-center justify-between font-semibold transition"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <span>Ver carrinho ({cartCount})</span>
          </div>
        </button>
      )}
    </div>
  );
}
