'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { ChangePasswordForm } from '@/components/change-password-form';
import { clearSession, getStoredUser } from '@/lib/session';
import { homePathFor } from '@/lib/roles';
import type { AuthUser } from '@/lib/types';

/** Primeiro acesso com senha provisória: a pessoa define a própria senha antes de usar o portal. */
export default function ForcedPasswordChangePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) router.replace('/login');
    else setUser(stored);
  }, [router]);

  function done(updated: AuthUser) {
    // Motorista não usa o portal: troca feita, ele segue pelo aplicativo.
    router.replace(updated.role === 'MOTORISTA' ? '/login' : homePathFor());
  }

  if (!user) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl sm:p-8">
        <ShieldCheck className="h-8 w-8 text-emerald-600 mb-3" />
        <h1 className="text-xl font-bold text-slate-900">Crie a sua senha</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">
          Olá, {user.name.split(' ')[0]}. Você entrou com uma senha provisória. Para continuar, defina uma senha só sua.
        </p>
        <ChangePasswordForm temporary onDone={done} />
        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-slate-500 hover:underline"
          onClick={() => { clearSession(); router.replace('/login'); }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
