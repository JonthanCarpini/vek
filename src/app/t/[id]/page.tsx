'use client';

import { use } from 'react';
import { OrderTrackingView } from '@/components/OrderTrackingView';

export default function PublicTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="min-h-screen">
      <OrderTrackingView orderId={id} heroLabel="Acompanhamento de pedido" />
    </div>
  );
}
