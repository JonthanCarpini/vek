'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OrderTrackingView } from '@/components/OrderTrackingView';

export default function DeliveryOrderTrackingPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/delivery/pedidos"
            className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-full"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="font-semibold text-gray-800">Detalhes do pedido</h1>
        </div>
      </header>
      <OrderTrackingView orderId={id} heroLabel="Pedido" inline />
    </div>
  );
}
