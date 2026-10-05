'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/lib/types';

const NAV_LINKS = [
  { name: 'Visão Geral',       path: '/dashboard' },
  { name: 'Frotas',            path: '/dashboard/fleets' },
  { name: 'Veículos',          path: '/dashboard/vehicles' },
  { name: 'Colaboradores',     path: '/dashboard/employees' },
  { name: 'Usuários',          path: '/dashboard/users' },
  { name: 'Templates',         path: '/dashboard/templates' },
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
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-white border-r shrink-0">
        <div className="h-16 flex items-center px-6 border-b">
          <span className="font-bold text-lg tracking-tight">CHECK-ON</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.path} href={link.path}>
              <Button
                variant={pathname === link.path ? 'secondary' : 'ghost'}
                className="w-full justify-start text-sm"
              >
                {link.name}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-2 truncate">
            {user.name}
          </p>
          <p className="text-xs text-muted-foreground px-2">
            {user.role?.name ?? 'Sem perfil'}
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
