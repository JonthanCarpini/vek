'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, MapPin, User } from 'lucide-react';
import { useDelivery } from '../_lib/context';

const TABS = [
  { href: '/delivery', label: 'Início', icon: Home, exact: true },
  { href: '/delivery/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/delivery/enderecos', label: 'Endereços', icon: MapPin },
  { href: '/delivery/perfil', label: 'Perfil', icon: User },
];

const ACTIVE_STATUSES = new Set(['received', 'accepted', 'preparing', 'ready', 'dispatched']);

export default function BottomNav() {
  const pathname = usePathname();
  const { activeOrdersCount } = useDelivery();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const showBadge = tab.href === '/delivery/pedidos' && activeOrdersCount > 0;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors ${
                active ? 'text-orange-500' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px] font-medium">{tab.label}</span>
              {showBadge && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-[16px] h-4 px-1 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeOrdersCount}
                </span>
              )}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { ACTIVE_STATUSES };
