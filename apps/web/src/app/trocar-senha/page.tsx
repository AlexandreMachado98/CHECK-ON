'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthHeading, AuthShell } from '@/components/auth-shell';
import { ChangePasswordForm } from '@/components/change-password-form';
import { clearSession, getStoredUser } from '@/lib/session';
import { homePathFor } from '@/lib/roles';
import type { AuthUser } from '@/lib/types';
import { useStoredUser } from '@/lib/use-stored-user';

/** Primeiro acesso com senha provisória: a pessoa define a própria senha antes de usar o portal. */
export default function ForcedPasswordChangePage() {
  const router = useRouter();
  const user = useStoredUser();

  // Sem sessão: volta ao login (lê direto do navegador; na hidratação o useStoredUser ainda é null).
  useEffect(() => {
    if (!getStoredUser()) router.replace('/login');
  }, [router]);

  function done(updated: AuthUser) {
    // Motorista não usa o portal: troca feita, ele segue pelo aplicativo.
    router.replace(updated.role === 'MOTORISTA' ? '/login' : homePathFor());
  }

  if (!user) return null;

  return (
    <AuthShell>
      <AuthHeading title="Defina sua senha">
        {user.name.split(' ')[0]}, você entrou com uma senha provisória. Crie uma senha pessoal para continuar.
      </AuthHeading>
        <ChangePasswordForm temporary onDone={done} />
      <button
        type="button"
        className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-800 hover:underline"
        onClick={() => { clearSession(); router.replace('/login'); }}
      >
        Sair
      </button>
    </AuthShell>
  );
}
