'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Banknote, Smartphone, Globe } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { deliveryApi, formatBRL } from '../_lib/api';

type PaymentMethod = 'cash' | 'credit' | 'debit' | 'pix' | 'online';

export default function CheckoutStep() {
  const router = useRouter();
  const {
    unit, cart, cartSubtotal, goTo, orderType,
    selectedAddressId, clearCart, reloadOrders,
  } = useDelivery();

  const [quote, setQuote] = useState<{ fee: number; estimatedMinutes: number; distanceKm: number; outOfRange: boolean } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [address, setAddress] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [changeFor, setChangeFor] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega endereço selecionado + cota
  useEffect(() => {
    if (orderType !== 'delivery') return;
    (async () => {
      const list = await deliveryApi.listAddresses();
      if (list.ok) {
        const addr = list.data.addresses.find((a: any) => a.id === selectedAddressId);
        if (addr) {
          setAddress(addr);
          if (addr.lat && addr.lng) {
            setQuoteLoading(true);
            const q = await deliveryApi.quote({
              lat: addr.lat, lng: addr.lng, orderSubtotal: cartSubtotal,
            });
            setQuoteLoading(false);
            if (q.ok) {
              setQuote({
                fee: q.data.fee,
                estimatedMinutes: q.data.estimatedMinutes,
                distanceKm: q.data.distanceKm,
                outOfRange: !!q.data.outOfRange,
              });
            }
          }
        }
      }
    })();
  }, [orderType, selectedAddressId, cartSubtotal]);

  const deliveryFee = orderType === 'delivery' ? (quote?.fee || 0) : 0;
  const total = cartSubtotal + deliveryFee;

  const availableMethods = unit?.paymentMethods || ['cash'];

  const allMethods: { id: PaymentMethod; label: string; icon: any; onDelivery: boolean }[] = [
    { id: 'cash', label: 'Dinheiro', icon: Banknote, onDelivery: true },
    { id: 'credit', label: 'Cartão de crédito', icon: CreditCard, onDelivery: true },
    { id: 'debit', label: 'Cartão de débito', icon: CreditCard, onDelivery: true },
    { id: 'pix', label: 'Pix', icon: Smartphone, onDelivery: true },
    { id: 'online', label: 'Pagar online agora', icon: Globe, onDelivery: false },
  ];
  const methodOptions = allMethods.filter(
    (m) => availableMethods.includes(m.id) || m.id === 'online',
  );

  const isStoreOpen = unit?.state?.isOpen ?? true;
  const outOfRange = orderType === 'delivery' && !!quote?.outOfRange;

  const handleSubmit = async () => {
    setError(null);
    if (!isStoreOpen) {
      setError('A loja está fechada no momento. Não é possível fazer pedidos agora.');
      return;
    }
    if (outOfRange) {
      setError('Endereço fora do raio de entrega. Escolha um endereço mais próximo ou use retirada no balcão.');
      return;
    }
    if (orderType === 'delivery' && !selectedAddressId) {
      setError('Selecione um endereço');
      return;
    }
    if (paymentMethod === 'cash' && changeFor) {
      const v = Number(changeFor.replace(',', '.'));
      if (v > 0 && v < total) {
        setError('Troco deve ser maior que o total do pedido');
        return;
      }
    }
    setSubmitting(true);
    const items = cart.map((i) => ({
      productId: i.productId, quantity: i.quantity, notes: i.notes,
    }));
    const res = await deliveryApi.createOrder({
      orderType, items, notes: notes.trim() || undefined,
      addressId: orderType === 'delivery' && selectedAddressId ? selectedAddressId : undefined,
      paymentMethod,
      changeFor: paymentMethod === 'cash' && changeFor
        ? Number(changeFor.replace(',', '.')) : undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    clearCart();
    goTo('menu');
    // Atualiza lista de pedidos para atualizar badge e navega para o tracking
    reloadOrders();
    router.push(`/delivery/pedidos/${res.data.order.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button
          onClick={() => goTo(orderType === 'delivery' ? 'address' : 'menu')}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Finalizar pedido</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Avisos bloqueantes — loja fechada ou fora de raio */}
        {!isStoreOpen && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">
            <strong>⚠️ Loja fechada.</strong> Você não pode finalizar o pedido agora. Volte quando estivermos abertos.
          </div>
        )}
        {isStoreOpen && outOfRange && quote && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
            <strong>📍 Endereço fora de área.</strong> Distância {quote.distanceKm}km — excede nosso raio de entrega.
            <button
              onClick={() => goTo('address')}
              className="block mt-2 text-amber-900 font-semibold underline"
            >
              Trocar de endereço
            </button>
          </div>
        )}

        {/* Endereço / Retirada */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-2">
            {orderType === 'delivery' ? '📍 Endereço de entrega' : '🛍️ Retirada no balcão'}
          </h2>
          {orderType === 'delivery' && address ? (
            <div className="text-sm text-gray-700">
              <p>{address.street}, {address.number} {address.complement && `- ${address.complement}`}</p>
              <p className="text-gray-500">{address.neighborhood}, {address.city}/{address.state}</p>
              {quoteLoading && <p className="text-xs text-gray-400 mt-1">Calculando frete...</p>}
              {quote && (
                <p className="text-xs text-gray-500 mt-1">
                  Distância: {quote.distanceKm}km • Previsão: ~{quote.estimatedMinutes}min
                </p>
              )}
            </div>
          ) : orderType === 'takeout' ? (
            <div className="text-sm text-gray-700">
              <p>{unit?.address || 'Retirar no estabelecimento'}</p>
              <p className="text-xs text-gray-500 mt-1">
                Previsão: ~{unit?.deliveryPrepTimeMin || 30}min para ficar pronto
              </p>
            </div>
          ) : null}
        </div>

        {/* Resumo */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-3">Resumo</h2>
          <div className="space-y-2">
            {cart.map((i) => (
              <div key={i.productId} className="flex justify-between text-sm">
                <span className="text-gray-700">{i.quantity}x {i.name}</span>
                <span className="text-gray-700">{formatBRL(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatBRL(cartSubtotal)}</span>
            </div>
            {orderType === 'delivery' && (
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega</span>
                <span>{deliveryFee === 0 ? 'Grátis' : formatBRL(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>Total</span>
              <span className="text-orange-600">{formatBRL(total)}</span>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-xl p-4">
          <label className="font-semibold block mb-2">Observações do pedido</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: sem cebola, ponto da carne..."
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-3">Forma de pagamento</h2>
          <div className="space-y-2">
            {methodOptions.map((m) => (
              <label
                key={m.id}
                className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                  paymentMethod === m.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="pm"
                  value={m.id}
                  checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)}
                  className="sr-only"
                />
                <m.icon className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{m.label}</div>
                  <div className="text-xs text-gray-500">
                    {m.onDelivery ? 'Pagar na entrega' : 'Pagar pelo Pix ou cartão agora'}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="mt-3">
              <label className="text-sm text-gray-600 mb-1 block">Troco para (opcional)</label>
              <input
                type="text"
                inputMode="decimal"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="Ex: 50,00"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          )}

          {paymentMethod === 'online' && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
              ℹ️ Pagamento online em breve. Por enquanto, use pagamento na entrega.
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              paymentMethod === 'online' ||
              !isStoreOpen ||
              outOfRange ||
              (orderType === 'delivery' && quoteLoading)
            }
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition flex items-center justify-between px-4"
          >
            <span>
              {submitting ? 'Enviando...'
                : !isStoreOpen ? 'Loja fechada'
                : outOfRange ? 'Fora da área de entrega'
                : 'Confirmar pedido'}
            </span>
            <span>{formatBRL(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
