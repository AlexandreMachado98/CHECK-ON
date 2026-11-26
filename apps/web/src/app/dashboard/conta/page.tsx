'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/components/change-password-form';
import { ChangeEmailForm } from '@/components/change-email-form';
import { getStoredUser } from '@/lib/session';
import { roleLabel } from '@/lib/roles';
import type { AuthUser } from '@/lib/types';
import { notifyStoredUserChange, useStoredUser } from '@/lib/use-stored-user';

/** Minha conta: dados do login e troca da própria senha. */
export default function AccountPage() {
  const user = useStoredUser();
  const [changed, setChanged] = useState(false);
  const [emailChanged, setEmailChanged] = useState('');

  function onEmailChanged(email: string) {
    const updated = { ...(getStoredUser() ?? user), email } as AuthUser;
    localStorage.setItem('user', JSON.stringify(updated));
    notifyStoredUserChange();
    setEmailChanged(email);
  }

  if (!user) return null;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Minha conta</h1>
        <p className="text-muted-foreground mt-1 text-sm">Seus dados de acesso e a sua senha.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-800">Seu login</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-3 text-sm">
            <p><span className="text-slate-500">Nome:</span> <strong>{user.name}</strong></p>
            <p><span className="text-slate-500">Perfil:</span> {roleLabel(user.role)}</p>
            {user.email && <p><span className="text-slate-500">E-mail:</span> {user.email}</p>}
            {user.tenantName && <p><span className="text-slate-500">Empresa:</span> {user.tenantName}{user.tenantCode ? ` (código ${user.tenantCode})` : ''}</p>}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-800">E-mail de acesso</CardTitle>
            <CardDescription>Use um e-mail que você abre: é para ele que vai o código de &quot;Esqueci minha senha&quot;.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {user.impersonating ? (
              <p className="text-sm text-slate-600">Você está dentro de uma empresa. Volte à plataforma para alterar o seu e-mail.</p>
            ) : emailChanged ? (
              <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                E-mail alterado para <strong>{emailChanged}</strong>. Use-o no próximo login.
              </p>
            ) : (
              <ChangeEmailForm currentEmail={user.email} onChanged={onEmailChanged} />
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-800">Alterar senha</CardTitle>
            <CardDescription>Use pelo menos 8 caracteres. Não use a mesma senha de outros sistemas.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {user.impersonating ? (
              <p className="text-sm text-slate-600">Você está dentro de uma empresa. Volte à plataforma para alterar a sua senha.</p>
            ) : changed ? (
              <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Senha alterada. Os outros aparelhos foram desconectados; este continua conectado.
              </p>
            ) : (
              <ChangePasswordForm onDone={() => { notifyStoredUserChange(); setChanged(true); }} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
