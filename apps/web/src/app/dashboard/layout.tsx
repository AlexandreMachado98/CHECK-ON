'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/lib/types';
import { 
  LayoutDashboard, 
  ClipboardCheck,
  ClipboardList,
  AlertOctagon,
  Truck, 
  Users, 
  ShieldCheck, 
  LogOut,
  Settings,
  AlertTriangle,
  BarChart3,
  Menu,
  X
} from 'lucide-react';

const MENU_GROUPS = [
  {
    title: 'OPERAÇÃO',
    items: [
      { name: 'Visão Geral', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Modelos', path: '/dashboard/templates', icon: ClipboardCheck },
      { name: 'Inspeções', path: '/dashboard/executions', icon: ClipboardList },
      { name: 'Não Conformidades', path: '/dashboard/ncs', icon: AlertOctagon },
    ]
  },
  {
    title: 'FROTA',
    items: [
      { name: 'Frotas & Veículos', path: '/dashboard/fleets', icon: Truck },
    ]
  },
  {
    title: 'PESSOAS',
    items: [
      { name: 'Colaboradores', path: '/dashboard/employees', icon: Users },
      { name: 'Usuários', path: '/dashboard/users', icon: ShieldCheck },
    ]
  },
  {
    title: 'ANÁLISE & SISTEMA',
    items: [
      { name: 'Relatórios', path: '/dashboard/reports', icon: BarChart3 },
      { name: 'Configurações', path: '/dashboard/settings', icon: Settings },
    ]
  }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
    } else {
      setUser(JSON.parse(stored));
    }
  }, [router]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Carregando painel...</p>
        </div>
      </div>
    );
  }

  const currentItem = MENU_GROUPS.flatMap(g => g.items).find(i => i.path === pathname);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/50 shrink-0">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center mr-3 shadow-md shadow-emerald-600/30">
            <ClipboardCheck className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">CHECK-ON</span>
        </div>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-850"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar px-3">
        {MENU_GROUPS.map((group, idx) => (
          <div key={idx} className="mb-6">
            <p className="px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(`${link.path}/`));
                return (
                  <Link key={link.path} href={link.path}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start h-10 px-4 text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 hover:text-emerald-300' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                      {link.name}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-bold text-sm shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.role?.name ?? 'Gestor'}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 h-9 text-xs" 
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair da plataforma
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-50 overflow-x-hidden">
      
      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-900 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Backdrop + Slide-in) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer Body */}
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b bg-white shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Hamburger Button (Mobile only) */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Context Breadcrumb / Section Name */}
            <div className="flex items-center text-sm font-medium text-slate-700">
              <span className="text-slate-400 hidden sm:inline">CHECK-ON /</span>
              <span className="sm:ml-1.5 font-semibold text-slate-900">{currentItem?.name || 'Operação'}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard/ncs">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Ver Não Conformidades">
                <AlertTriangle className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Configurações">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content with responsive padding */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
