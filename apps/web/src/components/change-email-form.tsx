'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = { currentEmail?: string | null; onChanged: (email: string) => void };

/** Troca do próprio e-mail: senha atual + novo e-mail, depois o código enviado ao novo e-mail. */
export function ChangeEmailForm({ currentEmail, onChanged }: Props) {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      const res = await api.post<{ requiresCode: boolean; message?: string; email?: string }>('/auth/change-email', {
        newEmail: newEmail.trim(),
        currentPassword: password,
      });
      if (res.data.requiresCode) {
        setInfo(res.data.message ?? '');
        setStep('code');
      } else if (res.data.email) {
        onChanged(res.data.email);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível alterar o e-mail.'));
    } finally {
      setSaving(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      const res = await api.post<{ email: string }>('/auth/change-email/confirm', { newEmail: newEmail.trim(), code: code.trim() });
      onChanged(res.data.email);
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível confirmar o código.'));
      setSaving(false);
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={confirm} className="space-y-4">
        <p role="status" className="flex items-start gap-2 text-sm text-slate-600">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {info}
        </p>
        <div className="space-y-2">
          <Label htmlFor="email-code">Código recebido no novo e-mail</Label>
          <Input id="email-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required maxLength={10} className="font-mono tracking-widest text-lg" />
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => { setStep('form'); setCode(''); setError(''); }}>Voltar</Button>
          <Button type="submit" className="flex-1" disabled={saving || !code}>{saving ? 'Confirmando...' : 'Confirmar novo e-mail'}</Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={request} className="space-y-4">
      <p className="text-sm text-slate-600">
        E-mail atual: <strong>{currentEmail || 'nenhum'}</strong>
      </p>
      <div className="space-y-2">
        <Label htmlFor="new-email">Novo e-mail</Label>
        <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoCapitalize="none" placeholder="um e-mail que você abre" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-password">Sua senha atual</Label>
        <Input id="email-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <p className="text-xs text-slate-500">Vamos mandar um código para o novo e-mail. Ele passa a valer para entrar e para recuperar a senha.</p>
      <Button type="submit" className="w-full" disabled={saving || !newEmail.trim() || !password}>
        {saving ? 'Enviando...' : 'Enviar código para o novo e-mail'}
      </Button>
    </form>
  );
}
