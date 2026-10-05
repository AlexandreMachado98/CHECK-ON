'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/lib/types';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  Truck, 
  Users, 
  ShieldCheck, 
  LogOut,
  Settings,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

const MENU_GROUPS = [
  {
    title: 'OPERAÇÃO',
    items: [
      { name: 'Visão Geral', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Templates', path: '/dashboard/templates', icon: ClipboardCheck },
    ]
  },
  {
    title: 'FROTA',
    items: [
      { name: 'Veículos', path: '/dashboard/vehicles', icon: Truck },
      { name: 'Frotas', path: '/dashboard/fleets', icon: FolderOpen },
    ]
  },
  {
    title: 'PESSOAS',
    items: [
      { name: 'Colaboradores', path: '/dashboard/employees', icon: Users },
      { name: 'Usuários', path: '/dashboard/users', icon: ShieldCheck },
    ]
  }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
    } else {
      setUser(JSON.parse(stored));
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      
      {/* Sidebar - Dark B2B Theme */}
      <aside className="w-64 flex flex-col bg-slate-950 text-slate-300 border-r border-slate-900 shrink-0">
        
        {/* Brand */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <ClipboardCheck className="h-6 w-6 text-primary mr-3" />
          <span className="font-bold text-lg tracking-tight text-white">CHECK-ON</span>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
          {MENU_GROUPS.map((group, idx) => (
            <div key={idx} className="mb-6 px-3">
              <p className="px-4 text-xs font-semibold text-slate-500 tracking-wider mb-2">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.path || pathname.startsWith(`${link.path}/`);
                  return (
                    <Link key={link.path} href={link.path}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start h-10 px-4 text-sm font-medium transition-colors ${
                          isActive 
                            ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                      >
                        <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
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
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.role?.name ?? 'Sem perfil'}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-900 h-9" 
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sair da plataforma
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-8 border-b bg-white shrink-0">
          <div className="flex items-center text-sm text-muted-foreground">
            {/* Breadcrumb placeholder or contextual info */}
            <span>Plataforma Administrativa</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
              <AlertTriangle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
