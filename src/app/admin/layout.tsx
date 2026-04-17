'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStaff, clearStaff, apiFetch } from '@/lib/staff-client';
import { getSocket, joinRooms } from '@/lib/socket-client';
import { PwaHead } from '@/components/PwaHead';
import { playNotificationSound } from '@/lib/notifications';
import { Download, Menu, X } from 'lucide-react';

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
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 4000); }

  useEffect(() => {
    // PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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
    setIsSidebarOpen(false); // Fecha a sidebar mobile ao navegar
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

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }

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
      
      {/* Top Bar */}
      <div className={`flex items-center justify-between px-4 py-2 text-sm border-b border-[color:var(--border)] sticky top-0 z-50 ${statusOpen ? 'bg-green-900/60 backdrop-blur-md' : 'bg-red-900/60 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg lg:hidden"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {unit?.logoUrl && <img src={unit.logoUrl} className="w-7 h-7 rounded-full object-cover hidden sm:block" alt="" />}
          <span className="font-semibold truncate max-w-[120px] sm:max-w-none">{unit?.name || 'Mesa Digital'}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${statusOpen ? 'bg-green-600' : 'bg-red-600'}`}>
            ● {statusOpen ? 'ABERTA' : 'FECHADA'}
          </span>
        </div>
        <div className="text-[10px] sm:text-xs text-gray-400 hidden xs:block">
          {storeState?.schedule && (
            <>{storeState.schedule.openTime}–{storeState.schedule.closeTime}</>
          )}
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 w-64 bg-[#0b0b0f] border-r border-[color:var(--border)] p-4 flex flex-col z-50
          transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="text-xl font-bold mb-6 flex items-center gap-2 lg:mt-0 mt-14">
            {unit?.logoUrl ? <img src={unit.logoUrl} className="w-8 h-8 rounded object-cover" alt="" /> : '🍔'}
            <span className="truncate">{unit?.name || 'Mesa Digital'}</span>
          </div>
          <nav className="flex flex-col gap-4 overflow-y-auto pr-2 scroll-none flex-1">
            {filteredGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <div className="text-[10px] uppercase text-gray-500 mb-1 tracking-widest px-3">
                  {group.label}
                </div>
                {group.items.map((n) => {
                  const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
                  return (
                    <Link 
                      key={n.href} 
                      href={n.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`px-3 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-3 touch-manipulation ${active ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : 'hover:bg-white/5 active:bg-white/10 text-gray-400 hover:text-white'}`}
                    >
                      <span className="text-lg opacity-80">{n.icon}</span>
                      <span className="font-medium tracking-tight">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
            {shortcuts.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-[10px] uppercase text-gray-500 mt-4 mb-1 tracking-widest px-3 font-bold">Operacional</div>
                {shortcuts.map((n) => (
                  <a 
                    key={n.href} 
                    href={n.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 active:bg-white/10 flex items-center justify-between text-gray-400 hover:text-white transition-all duration-200 touch-manipulation"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-lg opacity-80">{n.icon}</span>
                      <span className="font-medium tracking-tight">{n.label}</span>
                    </span>
                    <span className="text-gray-600 text-[10px]">↗</span>
                  </a>
                ))}
              </div>
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-[color:var(--border)]">
            {installPrompt && (
              <button 
                onClick={handleInstall}
                className="btn btn-primary btn-sm w-full mb-4 flex items-center justify-center gap-2"
              >
                <Download size={14} /> Instalar App
              </button>
            )}
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-xs uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{user.role.replace('_', ' ')}</div>
              </div>
            </div>
            <button onClick={() => { clearStaff(); router.push('/admin/login'); }} className="btn btn-ghost w-full text-xs py-2">Sair</button>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden w-full relative">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
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
