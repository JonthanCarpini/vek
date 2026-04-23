'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User } from 'lucide-react';
import { useDelivery } from './_lib/context';
import MenuStep from './_components/MenuStep';
import LoginStep from './_components/LoginStep';
import AddressStep from './_components/AddressStep';
import CheckoutStep from './_components/CheckoutStep';
import CartDrawer from './_components/CartDrawer';

export default function DeliveryHomePage() {
  const { unit, loadingUnit, step, customer } = useDelivery();
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loja indisponível</h1>
          <p className="text-gray-500">O delivery desta loja não está ativo no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {step === 'menu' && (
        <>
          <header className="bg-white border-b sticky top-0 z-20">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              {unit.logoUrl && (
                <div className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden">
                  <Image src={unit.logoUrl} alt={unit.name} fill sizes="40px" className="object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-gray-800 truncate">
                  {customer ? `Olá, ${customer.name.split(' ')[0]}` : unit.name}
                </h1>
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
              {!customer && (
                <Link
                  href="/delivery/perfil"
                  className="p-2 hover:bg-gray-100 rounded-full"
                  title="Entrar"
                >
                  <User className="w-4 h-4 text-gray-600" />
                </Link>
              )}
            </div>
          </header>
          <MenuStep onOpenCart={() => setCartOpen(true)} />
        </>
      )}

      {step === 'login' && <LoginStep />}
      {step === 'address' && <AddressStep />}
      {step === 'checkout' && <CheckoutStep />}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
