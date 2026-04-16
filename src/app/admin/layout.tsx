'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStaff, clearStaff } from '@/lib/staff-client';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/orders', label: 'Pedidos', icon: '🧾' },
  { href: '/admin/products', label: 'Produtos', icon: '🍔' },
  { href: '/admin/categories', label: 'Categorias', icon: '📂' },
  { href: '/admin/tables', label: 'Mesas & QR', icon: '🪑' },
  { href: '/admin/calls', label: 'Chamadas', icon: '🙋' },
  { href: '/admin/users', label: 'Usuários', icon: '👥' },
  { href: '/admin/reports', label: 'Relatórios', icon: '📈' },
  { href: '/admin/settings', label: 'Configurações', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    const s = loadStaff();
    if (!s) { router.push(`/admin/login?next=${pathname}`); return; }
    setUser(s.user);
  }, [pathname]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (!user) return <div className="p-10 text-gray-400">Carregando...</div>;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-[color:var(--border)] p-4 flex flex-col">
        <div className="text-xl font-bold mb-6">🍔 Mesa Digital</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href}
                className={`px-3 py-2 rounded-lg text-sm ${active ? 'bg-brand-600 text-white' : 'hover:bg-[#1f1f2b]'}`}>
                <span className="mr-2">{n.icon}</span>{n.label}
              </Link>
            );
          })}
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
