'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStaff, clearStaff } from '@/lib/staff-client';

type Role = 'super_admin' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';
interface NavItem { href: string; label: string; icon: string; roles: Role[]; external?: boolean }

const ADMIN_FULL: Role[] = ['super_admin', 'admin', 'manager'];
const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: '📊', roles: ADMIN_FULL },
  { href: '/admin/orders', label: 'Pedidos', icon: '🧾', roles: ADMIN_FULL },
  { href: '/admin/products', label: 'Produtos', icon: '🍔', roles: ADMIN_FULL },
  { href: '/admin/categories', label: 'Categorias', icon: '📂', roles: ADMIN_FULL },
  { href: '/admin/tables', label: 'Mesas & QR', icon: '🪑', roles: ADMIN_FULL },
  { href: '/admin/calls', label: 'Chamadas', icon: '🙋', roles: ADMIN_FULL },
  { href: '/admin/users', label: 'Usuários', icon: '👥', roles: ['super_admin', 'admin'] },
  { href: '/admin/reports', label: 'Relatórios', icon: '📈', roles: ADMIN_FULL },
  { href: '/admin/settings', label: 'Configurações', icon: '⚙️', roles: ADMIN_FULL },
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

  if (pathname === '/admin/login') return <>{children}</>;
  if (!user) return <div className="p-10 text-gray-400">Carregando...</div>;

  const role = user.role as Role;
  const navItems = NAV.filter((n) => n.roles.includes(role));
  const shortcuts = SHORTCUTS.filter((n) => n.roles.includes(role));

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-[color:var(--border)] p-4 flex flex-col">
        <div className="text-xl font-bold mb-6">🍔 Mesa Digital</div>
        <nav className="flex flex-col gap-1">
          {navItems.map((n) => {
            const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href}
                className={`px-3 py-2 rounded-lg text-sm ${active ? 'bg-brand-600 text-white' : 'hover:bg-[#1f1f2b]'}`}>
                <span className="mr-2">{n.icon}</span>{n.label}
              </Link>
            );
          })}
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
  );
}
