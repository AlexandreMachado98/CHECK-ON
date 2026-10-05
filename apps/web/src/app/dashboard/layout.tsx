'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string, role?: { name: string } } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (!user) return null;

  const links = [
    { name: 'Visão Geral', path: '/dashboard' },
    { name: 'Frotas', path: '/dashboard/fleets' },
    { name: 'Veículos', path: '/dashboard/vehicles' },
  ];

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="w-64 flex flex-col bg-white border-r">
        <div className="h-16 flex items-center px-6 border-b">
          <span className="font-bold text-lg tracking-tight">CHECK-ON</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {links.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link key={link.path} href={link.path}>
                <Button 
                  variant={isActive ? 'secondary' : 'ghost'} 
                  className="w-full justify-start"
                >
                  {link.name}
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="text-sm font-medium px-2 mb-4 truncate">
            {user.name}
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
