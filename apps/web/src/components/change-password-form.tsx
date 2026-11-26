'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage, type AuthUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';

type Props = {
  /** Senha provisória: o campo "atual" é a senha recebida da empresa. */
  temporary?: boolean;
  onDone: (user: AuthUser) => void;
};

/** Troca da própria senha. A API encerra os outros logins e devolve tokens novos para este aparelho. */
export function ChangePasswordForm({ temporary = false, onDone }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current && next.length >= 8 && next === confirm && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setSaving(true);
      setError('');
      const res = await api.post<{ access_token: string; user: AuthUser }>('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onDone(res.data.user);
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível alterar a senha.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current-password">{temporary ? 'Senha provisória (recebida da empresa)' : 'Senha atual'}</Label>
        <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha (mínimo 8 caracteres)</Label>
        <PasswordInput id="new-password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Repita a nova senha</Label>
        <PasswordInput id="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} />
        {mismatch && <p className="text-xs text-rose-700">As senhas não são iguais.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <p className="text-xs text-slate-500">Ao trocar a senha, você sai dos outros aparelhos (portal e aplicativo) e continua conectado neste.</p>
      <Button type="submit" className="h-11 w-full bg-emerald-700 font-semibold text-white hover:bg-emerald-800" disabled={!canSubmit}>
        <KeyRound className="mr-2 h-4 w-4" />
        {saving ? 'Salvando...' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
