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

/** Verifica se o elemento ou algum ancestral tem o atributo data-no-tab-swipe. */
function hasNoSwipeAncestor(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    if (cur instanceof HTMLElement && cur.dataset.noTabSwipe != null) return true;
    cur = cur.parentElement;
  }
  return false;
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { step } = useDelivery();

  // Oculta a tab bar apenas nos sub-steps do Home (login/address/checkout full-screen)
  const hideNav = pathname === '/delivery' && step !== 'menu';

  // Índice da tab atual para habilitar swipe; -1 quando estamos numa sub-rota (ex: /pedidos/[id])
  const currentIdx = TAB_ORDER.indexOf(pathname);
  const canSwipe = !hideNav && currentIdx !== -1;

  // Quando o toque inicia dentro de um elemento com [data-no-tab-swipe] (ex: scroll
  // horizontal de categorias, carrossel, etc.) não mudamos de tab.
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (!canSwipe) return;
      if (hasNoSwipeAncestor(e.event.target as Element | null)) return;
      const next = TAB_ORDER[currentIdx + 1];
      if (next) router.push(next);
    },
    onSwipedRight: (e) => {
      if (!canSwipe) return;
      if (hasNoSwipeAncestor(e.event.target as Element | null)) return;
      const prev = TAB_ORDER[currentIdx - 1];
      if (prev) router.push(prev);
    },
    trackTouch: true,
    trackMouse: false,
    delta: 60, // min distância em px
    preventScrollOnSwipe: false,
  });

  return (
    // Força tema claro só neste escopo (o body global é dark para admin).
    // Tailwind "text-gray-800" garante cor padrão legível para elementos
    // sem classe explícita (títulos, textareas, inputs, etc.).
    <div className="min-h-screen bg-gray-50 text-gray-800 delivery-theme">
      <div {...(canSwipe ? swipeHandlers : {})} className={hideNav ? '' : 'pb-20'}>
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
