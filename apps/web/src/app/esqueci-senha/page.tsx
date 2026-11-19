'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { setLoginNotice } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      window.location.assign('/login');
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível trocar a senha.'));
      setSending(false);
    }
  }

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl sm:p-8">
        <Link href="/login" className="mb-4 inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar ao login
        </Link>

        {step === 'email' ? (
          <>
            <KeyRound className="h-8 w-8 text-emerald-600 mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Esqueci minha senha</h1>
            <p className="mt-1 mb-6 text-sm text-slate-600">Informe o e-mail do seu acesso. Vamos enviar um código para você criar uma senha nova.</p>
            <form onSubmit={requestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">E-mail</Label>
                <Input id="recovery-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoCapitalize="none" placeholder="seu.email@empresa.com.br" />
              </div>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <Button type="submit" className="w-full" disabled={sending || !email.trim()}>
                {sending ? 'Enviando...' : 'Enviar código'}
              </Button>
            </form>
            <p className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Entra com <strong>código da empresa + matrícula</strong> e não tem e-mail cadastrado? Peça uma nova senha ao administrador da sua empresa.
            </p>
          </>
        ) : (
          <>
            <MailCheck className="h-8 w-8 text-emerald-600 mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Digite o código</h1>
            <p role="status" className="mt-1 mb-6 text-sm text-slate-600">{info}</p>
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Código recebido por e-mail</Label>
                <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required maxLength={10} className="font-mono tracking-widest text-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-new">Nova senha (mínimo 8 caracteres)</Label>
                <Input id="recovery-new" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-confirm">Repita a nova senha</Label>
                <Input id="recovery-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} />
                {mismatch && <p className="text-xs text-rose-700">As senhas não são iguais.</p>}
              </div>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <Button type="submit" className="w-full" disabled={sending || !code || password.length < 8 || password !== confirm}>
                {sending ? 'Salvando...' : 'Salvar nova senha'}
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
      </div>
    </div>
  );
}
