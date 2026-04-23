'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ChefHat, Package, Bike, Check } from 'lucide-react';
import { useDelivery } from '../_lib/context';
import { deliveryApi, formatBRL } from '../_lib/api';

const STEPS = [
  { id: 'received', label: 'Pedido recebido', icon: CheckCircle2 },
  { id: 'accepted', label: 'Confirmado', icon: Clock },
  { id: 'preparing', label: 'Em preparo', icon: ChefHat },
  { id: 'ready', label: 'Pronto', icon: Package },
  { id: 'dispatched', label: 'Saiu para entrega', icon: Bike },
  { id: 'delivered', label: 'Entregue', icon: Check },
];

const STEP_ORDER: Record<string, number> = {
  received: 0, accepted: 1, preparing: 2, ready: 3, dispatched: 4, delivered: 5, cancelled: -1,
};

export default function TrackingStep() {
  const { trackingOrderId, goTo, setTrackingOrderId } = useDelivery();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackingOrderId) return;
    let mounted = true;

    const load = async () => {
      const res = await deliveryApi.getOrder(trackingOrderId);
      if (!mounted) return;
      if (res.ok) setOrder(res.data.order);
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 15_000); // polling a cada 15s
    return () => { mounted = false; clearInterval(interval); };
  }, [trackingOrderId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando pedido...</div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center">Pedido não encontrado</div>;

  const currentStep = STEP_ORDER[order.status] ?? 0;
  const isCancelled = order.status === 'cancelled';
  const isTakeout = order.orderType === 'takeout';

  const visibleSteps = isTakeout
    ? STEPS.filter((s) => s.id !== 'dispatched')
    : STEPS;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6">
        <p className="text-sm opacity-90">Pedido</p>
        <h1 className="text-3xl font-bold">#{order.sequenceNumber}</h1>
        <p className="mt-2 text-sm opacity-90">
          {isTakeout ? 'Retirada no balcão' : 'Entrega em domicílio'}
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {isCancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
            <h2 className="font-bold mb-1">Pedido cancelado</h2>
            <p className="text-sm">Entre em contato com o estabelecimento para mais informações.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-4">Status do pedido</h2>
            <div className="space-y-3">
              {visibleSteps.map((step, idx) => {
                const active = idx <= currentStep;
                const current = idx === currentStep;
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                        active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
                      } ${current ? 'ring-4 ring-orange-200 animate-pulse' : ''}`}
                    >
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm ${active ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {order.driver && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-2">🛵 Entregador</h2>
            <p className="text-sm text-gray-700">{order.driver.name}</p>
            {order.driver.phone && (
              <a
                href={`tel:${order.driver.phone}`}
                className="text-sm text-orange-600 hover:underline"
              >
                {order.driver.phone}
              </a>
            )}
          </div>
        )}

        {order.estimatedDeliveryAt && !isCancelled && order.status !== 'delivered' && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-1">⏱️ Previsão de {isTakeout ? 'retirada' : 'entrega'}</h2>
            <p className="text-2xl font-bold text-orange-600">
              {new Date(order.estimatedDeliveryAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-3">Resumo</h2>
          <div className="space-y-2 text-sm">
            {order.items.map((i: any) => (
              <div key={i.id} className="flex justify-between">
                <span className="text-gray-700">{i.quantity}x {i.name}</span>
                <span className="text-gray-700">{formatBRL(i.totalPrice)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatBRL(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega</span>
                <span>{formatBRL(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1">
              <span>Total</span>
              <span className="text-orange-600">{formatBRL(order.total)}</span>
            </div>
          </div>
        </div>

        {order.deliveryAddress && (
          <div className="bg-white rounded-xl p-4">
            <h2 className="font-semibold mb-1">📍 Endereço</h2>
            <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
          </div>
        )}

        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-1">💳 Pagamento</h2>
          <p className="text-sm text-gray-700">
            {({
              cash: 'Dinheiro na entrega',
              credit: 'Cartão de crédito na entrega',
              debit: 'Cartão de débito na entrega',
              pix: 'Pix na entrega',
              online: 'Pagamento online',
            } as any)[order.paymentMethod] || order.paymentMethod}
          </p>
          {order.changeFor && (
            <p className="text-xs text-gray-500 mt-1">Troco para {formatBRL(order.changeFor)}</p>
          )}
        </div>

        <button
          onClick={() => {
            setTrackingOrderId(null);
            goTo('menu');
          }}
          className="w-full py-3 border-2 border-orange-500 text-orange-500 rounded-lg font-semibold hover:bg-orange-50"
        >
          Fazer novo pedido
        </button>
      </div>
    </div>
  );
}
