'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStaff, clearStaff, apiFetch } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { PwaHead } from '@/components/PwaHead';
import { playNotificationSound } from '@/lib/notifications';

type Role = 'super_admin' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';
interface NavItem { href: string; label: string; icon: string; roles: Role[]; external?: boolean }

const ADMIN_FULL: Role[] = ['super_admin', 'admin', 'manager'];

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊', roles: ADMIN_FULL },
      { href: '/admin/orders', label: 'Pedidos', icon: '🧾', roles: ADMIN_FULL },
      { href: '/admin/calls', label: 'Chamadas', icon: '🙋', roles: ADMIN_FULL },
    ]
  },
  {
    label: 'Cardápio',
    items: [
      { href: '/admin/products', label: 'Produtos', icon: '🍔', roles: ADMIN_FULL },
      { href: '/admin/categories', label: 'Categorias', icon: '📂', roles: ADMIN_FULL },
      { href: '/admin/ingredients', label: 'Ingredientes', icon: '🥬', roles: ADMIN_FULL },
    ]
  },
  {
    label: 'Gestão',
    items: [
      { href: '/admin/customers', label: 'Clientes', icon: '🧑', roles: ADMIN_FULL },
      { href: '/admin/tables', label: 'Mesas & QR', icon: '�', roles: ADMIN_FULL },
      { href: '/admin/display', label: 'Painel TV (mídia)', icon: '📺', roles: ADMIN_FULL },
    ]
  },
  {
    label: 'Administração',
    items: [
      { href: '/admin/users', label: 'Usuários', icon: '👥', roles: ['super_admin', 'admin'] },
      { href: '/admin/reports', label: 'Relatórios', icon: '📈', roles: ADMIN_FULL },
      { href: '/admin/settings', label: 'Configurações', icon: '⚙️', roles: ADMIN_FULL },
    ]
  }
];

const SHORTCUTS: NavItem[] = [
  { href: '/kds', label: 'Cozinha (KDS)', icon: '🍳', roles: ADMIN_FULL, external: true },
  { href: '/waiter', label: 'Garçom', icon: '🛎️', roles: ADMIN_FULL, external: true },
  { href: '/cashier', label: 'Caixa', icon: '💰', roles: ADMIN_FULL, external: true },
  { href: '/display', label: 'Painel TV', icon: '📺', roles: ADMIN_FULL, external: true },
];

const HOME_BY_ROLE: Record<Role, string> = {
  super_admin: '/admin', admin: '/admin', manager: '/admin',
  kitchen: '/kds', waiter: '/waiter', cashier: '/cashier',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [storeState, setStoreState] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 4000); }

  useEffect(() => {
    if (pathname === '/admin/login') return;
    const s = loadStaff();
    if (!s) { router.push(`/admin/login?next=${pathname}`); return; }
    const role = s.user.role as Role;
    if (!ADMIN_FULL.includes(role)) {
      const home = HOME_BY_ROLE[role] || '/admin/login';
      if (pathname !== home) { router.replace(home); return; }
    }
    setUser(s.user);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const [u, st] = await Promise.all([
          fetch('/api/v1/public/unit').then((r) => r.json()).catch(() => null),
          apiFetch('/api/v1/admin/store-state').catch(() => null),
        ]);
        if (cancelled) return;
        if (u?.data?.unit) setUnit(u.data.unit);
        if (st?.state) setStoreState(st.state);
      } catch {}
    }
    load();
    const i = setInterval(load, 15000);
    if (user?.unitId) {
      joinRooms([`unit:${user.unitId}:dashboard`]);
      const sock = getSocket();
      const r = () => load();
      sock.on('store.state_changed', r);
      
      // Notificações sonoras
      const onOrder = (p: any) => { 
        load(); 
        playNotificationSound('order'); 
        showToast(`Novo pedido #${p?.sequenceNumber || ''}`); 
      };
      const onCall = (p: any) => { 
        load(); 
        playNotificationSound('call'); 
        showToast(`Chamado na mesa ${p?.table?.number || ''}`); 
      };
      
      sock.on('order.created', onOrder);
      sock.on('call.created', onCall);

      return () => { 
        clearInterval(i); 
        cancelled = true; 
        sock.off('store.state_changed', r);
        sock.off('order.created', onOrder);
        sock.off('call.created', onCall);
      };
    }
    return () => { clearInterval(i); cancelled = true; };
  }, [user]);

  // Aplica cor primária + título dinâmicos
  useEffect(() => {
    if (unit?.primaryColor) document.documentElement.style.setProperty('--brand', unit.primaryColor);
    if (unit?.name) document.title = `${unit.name} — Admin`;
  }, [unit?.primaryColor, unit?.name]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (!user) return <div className="p-10 text-gray-400">Carregando...</div>;

  const role = user.role as Role;
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(role))
  })).filter(group => group.items.length > 0);
  
  const shortcuts = SHORTCUTS.filter((n) => n.roles.includes(role));

  const statusOpen = storeState?.open === true;
  const statusText = storeState ? (statusOpen ? 'Loja ABERTA' : 'Loja FECHADA') : 'Verificando...';
  const statusReason = storeState?.reason;

  return (
    <div className="min-h-screen flex flex-col">
      <PwaHead manifest="/manifest-admin.json" />
      <div className={`flex items-center justify-between px-4 py-2 text-sm border-b border-[color:var(--border)] ${statusOpen ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
        <div className="flex items-center gap-3">
          {unit?.logoUrl && <img src={unit.logoUrl} className="w-7 h-7 rounded-full object-cover" alt="" />}
          <span className="font-semibold">{unit?.name || 'Mesa Digital'}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusOpen ? 'bg-green-600' : 'bg-red-600'}`}>
            ● {statusText}
          </span>
          {statusReason && <span className="text-xs text-gray-300">{statusReason}</span>}
        </div>
        <div className="text-xs text-gray-400">
          {storeState?.schedule && (
            <>Hoje: {storeState.schedule.openTime}–{storeState.schedule.closeTime}</>
          )}
        </div>
      </div>
    <div className="flex flex-1">
      <aside className="w-60 border-r border-[color:var(--border)] p-4 flex flex-col">
        <div className="text-xl font-bold mb-6 flex items-center gap-2">
          {unit?.logoUrl ? <img src={unit.logoUrl} className="w-8 h-8 rounded object-cover" alt="" /> : '🍔'}
          <span className="truncate">{unit?.name || 'Mesa Digital'}</span>
        </div>
        <nav className="flex flex-col gap-4">
          {filteredGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <div className="text-[10px] uppercase text-gray-500 mb-1 tracking-widest px-3">
                {group.label}
              </div>
              {group.items.map((n) => {
                const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
                return (
                  <Link key={n.href} href={n.href}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-brand-600 text-white shadow-md' : 'hover:bg-[#1f1f2b] text-gray-300 hover:text-white'}`}>
                    <span className="mr-2">{n.icon}</span>{n.label}
                  </Link>
                );
              })}
            </div>
          ))}
          {shortcuts.length > 0 && (
            <>
              <div className="text-[10px] uppercase text-gray-500 mt-4 mb-1 tracking-widest">Áreas operacionais</div>
              {shortcuts.map((n) => (
                <a key={n.href} href={n.href} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg text-sm hover:bg-[#1f1f2b] flex items-center justify-between">
                  <span><span className="mr-2">{n.icon}</span>{n.label}</span>
                  <span className="text-gray-500 text-xs">↗</span>
                </a>
              ))}
            </>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-[color:var(--border)]">
          <div className="text-sm truncate">{user.name}</div>
          <div className="text-xs text-gray-500 mb-3">{user.role}</div>
          <button onClick={() => { clearStaff(); router.push('/admin/login'); }} className="btn btn-ghost w-full text-sm">Sair</button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">{children}</main>
    </div>

    {/* Toast Notification */}
    {toast && (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-brand-600 text-white px-6 py-3 rounded-full shadow-2xl animate-fade-in font-bold flex items-center gap-2">
        <span className="text-xl">🔔</span> {toast}
      </div>
    )}
    </div>
  );
}
