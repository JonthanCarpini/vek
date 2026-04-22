'use client';

import { use, useState } from 'react';
import Image from 'next/image';
import { User, LogOut } from 'lucide-react';
import { DeliveryProvider, useDelivery } from './_lib/context';
import MenuStep from './_components/MenuStep';
import LoginStep from './_components/LoginStep';
import AddressStep from './_components/AddressStep';
import CheckoutStep from './_components/CheckoutStep';
import TrackingStep from './_components/TrackingStep';
import CartDrawer from './_components/CartDrawer';

export default function DeliveryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <DeliveryProvider slug={slug}>
      <DeliveryApp />
    </DeliveryProvider>
  );
}

function DeliveryApp() {
  const { unit, loadingUnit, step, customer, logout } = useDelivery();
  const [cartOpen, setCartOpen] = useState(false);

  if (loadingUnit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loja não encontrada</h1>
          <p className="text-gray-500">Verifique o endereço e tente novamente.</p>
        </div>
      </div>
    );
  }

  // Header com logo/nome (aparece em Menu e checkout)
  const showHeader = step === 'menu';

  return (
    <>
      {showHeader && (
        <header className="bg-white border-b sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            {unit.logoUrl && (
              <div className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden">
                <Image src={unit.logoUrl} alt={unit.name} fill sizes="40px" className="object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-800 truncate">{unit.name}</h1>
              <p className="text-xs text-gray-500">
                {unit.state?.isOpen ? (
                  <span className="text-green-600">● Aberto agora</span>
                ) : (
                  <span className="text-red-600">● Fechado</span>
                )}
                {' · '}
                {unit.deliveryEnabled && `Entrega em ~${unit.deliveryAvgTimeMin + unit.deliveryPrepTimeMin}min`}
              </p>
            </div>
            {customer ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:inline">Olá, {customer.name.split(' ')[0]}</span>
                <button
                  onClick={logout}
                  title="Sair"
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <LogOut className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => (document.location.hash = '#login')}
                className="p-2 hover:bg-gray-100 rounded-full"
                title="Entrar"
              >
                <User className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </header>
      )}

      {step === 'menu' && <MenuStep onOpenCart={() => setCartOpen(true)} />}
      {step === 'login' && <LoginStep />}
      {step === 'address' && <AddressStep />}
      {step === 'checkout' && <CheckoutStep />}
      {step === 'tracking' && <TrackingStep />}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
