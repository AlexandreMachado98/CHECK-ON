'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthHeading, AuthShell } from '@/components/auth-shell';
import { PasswordInput } from '@/components/password-input';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { setLoginNotice } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hardNavigate } from '@/lib/navigation';

/**
 * Esqueci minha senha: 1) informa o e-mail e recebe um código; 2) digita o código e a senha nova.
 * Quem não tem e-mail (ex.: motorista) recupera a senha com a empresa.
 */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setSending(true);
      setError('');
      const res = await api.post<{ message: string }>('/auth/forgot-password', { email: email.trim() });
      setInfo(res.data.message);
      setStep('code');
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível enviar o código agora. Tente de novo em instantes.'));
    } finally {
      setSending(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return;
    try {
      setSending(true);
      setError('');
      const res = await api.post<{ message: string }>('/auth/reset-password-code', { email: email.trim(), code: code.trim(), newPassword: password });
      setLoginNotice(res.data.message);
      hardNavigate('/login');
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível trocar a senha.'));
      setSending(false);
    }
  }

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <AuthShell>

        {step === 'email' ? (
          <>
            <AuthHeading title="Redefinir senha">Informe o e-mail do seu acesso para receber um código.</AuthHeading>
            <form onSubmit={requestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">E-mail</Label>
                <Input id="recovery-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoCapitalize="none" autoComplete="username" placeholder="nome@empresa.com.br" className="h-11" />
              </div>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <Button type="submit" className="h-11 w-full bg-emerald-700 font-semibold text-white hover:bg-emerald-800" disabled={sending} aria-busy={sending}>
                {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Enviando…</> : 'Enviar código'}
              </Button>
            </form>
            <p className="mt-6 text-xs text-slate-500">
              Acesso por código da empresa e matrícula: a nova senha é gerada pelo administrador da sua empresa.
            </p>
          </>
        ) : (
          <>
            <div role="status"><AuthHeading title="Digite o código">{info}</AuthHeading></div>
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Código recebido por e-mail</Label>
                <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required maxLength={10} className="h-11 font-mono text-lg tracking-widest" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-new">Nova senha (mínimo 8 caracteres)</Label>
                <PasswordInput id="recovery-new" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-confirm">Repita a nova senha</Label>
                <PasswordInput id="recovery-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} className="h-11" />
                {mismatch && <p className="text-xs text-rose-700">As senhas não são iguais.</p>}
              </div>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <Button type="submit" className="h-11 w-full bg-emerald-700 font-semibold text-white hover:bg-emerald-800" disabled={sending || !code || password.length < 8 || password !== confirm} aria-busy={sending}>
                {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Salvando…</> : 'Salvar nova senha'}
              </Button>
            </form>
            <div className="mt-4 flex justify-between text-xs">
              <button type="button" className="text-slate-500 hover:underline" onClick={() => { setStep('email'); setError(''); setCode(''); }}>
                Trocar e-mail
              </button>
              <button type="button" className="text-emerald-700 hover:underline" disabled={sending} onClick={() => requestCode()}>
                Enviar outro código
              </button>
            </div>
          </>
        )}

        <Link href="/login" className="mt-6 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Voltar para o login
        </Link>
    </AuthShell>
  );
}
