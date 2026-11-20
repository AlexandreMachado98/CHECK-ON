'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { homePathFor } from '@/lib/roles';
import { clearSession, takeLoginNotice } from '@/lib/session';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { AuthHeading, AuthShell, LoginIntro } from '@/components/auth-shell';
import { PasswordInput } from '@/components/password-input';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setNotice(takeLoginNotice());
  }, []);

  const [mode, setMode] = useState<'email' | 'matricula'>('email');
  const [companyCode, setCompanyCode] = useState('');
  const [matricula, setMatricula] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      const credentials = mode === 'email'
        ? { email: email.trim(), password }
        : { companyCode: companyCode.trim(), matricula: matricula.trim(), password };
      const response = await api.post('/auth/login', credentials);
      const { access_token, user } = response.data;
      
      clearSession(); // descarta sessão antiga, inclusive uma guardada de "Acessar empresa"
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Senha provisória (criada pela empresa): primeiro define a senha própria.
      router.push(user?.mustChangePassword ? '/trocar-senha' : homePathFor());
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string | string[] } } };
      const apiMessage = axiosErr.response?.data?.message;
      if (axiosErr.response?.status === 401 || axiosErr.response?.status === 429) {
        // A API diferencia senha errada, acesso bloqueado e empresa desativada.
        setError(typeof apiMessage === 'string' ? apiMessage : 'E-mail ou senha incorretos. Verifique os dados e tente novamente.');
      } else if (axiosErr.response?.status === 400 && apiMessage) {
        setError(Array.isArray(apiMessage) ? apiMessage.join(' ') : apiMessage);
      } else {
        setError('Não foi possível acessar sua conta agora. Tente novamente em instantes.');
      }
    } finally {
      setLoading(false);
    }
  }

  const tabs = [['email', 'E-mail'], ['matricula', 'Código da empresa']] as const;
  const inputClass = 'h-11 text-slate-900';

  return (
    <AuthShell intro={<LoginIntro />}>
      <AuthHeading title="Entrar" />

      <form onSubmit={onSubmit} className="space-y-5">
        <div role="tablist" aria-label="Forma de entrar" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => { setMode(value); setError(''); }}
              className={`whitespace-nowrap rounded-md px-2 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'email' ? (
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoCapitalize="none"
              autoComplete="username"
              className={inputClass}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="companyCode" className="text-slate-700">Código da empresa</Label>
              <Input
                id="companyCode"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                required
                autoFocus
                autoCapitalize="characters"
                autoComplete="organization"
                className={`${inputClass} uppercase`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matricula" className="text-slate-700">Matrícula</Label>
              <Input
                id="matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                required
                autoCapitalize="none"
                autoComplete="username"
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-700">Senha</Label>
            {mode === 'email' ? (
              <Link href="/esqueci-senha" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">Esqueci minha senha</Link>
            ) : (
              <span className="text-xs text-slate-500">Esqueceu? Fale com a sua empresa</span>
            )}
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        {notice && !error && (
          <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <Button
          type="submit"
          className="h-11 w-full bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Entrando…
            </span>
          ) : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  );
}
