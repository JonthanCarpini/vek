'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useSwipeable } from 'react-swipeable';
import { DeliveryProvider, useDelivery } from './_lib/context';
import BottomNav from './_components/BottomNav';

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeliveryProvider>
      <Shell>{children}</Shell>
    </DeliveryProvider>
  );
}

// Ordem das tabs para swipe horizontal
const TAB_ORDER = [
  '/delivery',
  '/delivery/pedidos',
  '/delivery/enderecos',
  '/delivery/perfil',
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { step } = useDelivery();

  // Oculta a tab bar apenas nos sub-steps do Home (login/address/checkout full-screen)
  const hideNav = pathname === '/delivery' && step !== 'menu';

  // Índice da tab atual para habilitar swipe; -1 quando estamos numa sub-rota (ex: /pedidos/[id])
  const currentIdx = TAB_ORDER.indexOf(pathname);
  const canSwipe = !hideNav && currentIdx !== -1;

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (!canSwipe) return;
      const next = TAB_ORDER[currentIdx + 1];
      if (next) router.push(next);
    },
    onSwipedRight: () => {
      if (!canSwipe) return;
      const prev = TAB_ORDER[currentIdx - 1];
      if (prev) router.push(prev);
    },
    trackTouch: true,
    trackMouse: false,
    delta: 60, // min distância em px
    preventScrollOnSwipe: false,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div {...(canSwipe ? swipeHandlers : {})} className={hideNav ? '' : 'pb-20'}>
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
