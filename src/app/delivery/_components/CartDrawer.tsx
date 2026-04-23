'use client';

import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { formatBRL } from '../_lib/api';

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    cart, cartSubtotal, updateQty, removeFromCart,
    unit, customer, orderType, setOrderType, goTo, clearCart,
  } = useDelivery();

  if (!open) return null;

  const minOrder = unit?.deliveryMinOrder || 0;
  const belowMin = orderType === 'delivery' && cartSubtotal < minOrder;

  const handleNext = () => {
    if (belowMin) return;
    if (!customer) {
      goTo('login');
    } else if (orderType === 'delivery') {
      goTo('address');
    } else {
      goTo('checkout');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/50" onClick={onClose}>
      <div
        className="mt-auto bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Seu pedido</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo de entrega */}
        {unit?.deliveryEnabled && unit?.takeoutEnabled && (
          <div className="px-4 pt-3">
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
                  orderType === 'delivery' ? 'bg-white shadow' : 'text-gray-600'
                }`}
              >
                🛵 Entrega
              </button>
              <button
                onClick={() => setOrderType('takeout')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
                  orderType === 'takeout' ? 'bg-white shadow' : 'text-gray-600'
                }`}
              >
                🛍️ Retirada
              </button>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Carrinho vazio</div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-sm text-gray-500">{formatBRL(item.price)}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQty(item.productId, item.quantity - 1)}
                      className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.productId, item.quantity + 1)}
                      className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="ml-auto text-sm font-semibold text-gray-700">
                      {formatBRL(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">{formatBRL(cartSubtotal)}</span>
            </div>
            {belowMin && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                Pedido mínimo para delivery: {formatBRL(minOrder)}
              </div>
            )}
            <button
              onClick={handleNext}
              disabled={belowMin}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition"
            >
              Continuar →
            </button>
            <button
              onClick={() => {
                if (confirm('Limpar o carrinho?')) clearCart();
              }}
              className="w-full text-sm text-gray-500 hover:text-red-500"
            >
              Esvaziar carrinho
            </button>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
