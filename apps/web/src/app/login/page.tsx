'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, ShieldCheck, CheckCircle2, Truck, AlertOctagon, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/login', { email: email.trim(), password });
      const { access_token, user } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 401) {
        setError('E-mail ou senha incorretos. Verifique os dados e tente novamente.');
      } else {
        setError('Não foi possível acessar sua conta agora. Tente novamente em instantes.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-950">
      
      {/* Área Institucional (Desktop & Tablet) */}
      <div className="lg:flex-1 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-850">
        <div>
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">CHECK-ON</span>
          </div>

          {/* Headline & Subtexto */}
          <div className="mt-10 sm:mt-16 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              Gestão Operacional de Frotas & Checklists
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Inspeções mais simples. <br className="hidden sm:inline" />
              <span className="text-emerald-400">Gestão mais segura.</span>
            </h1>
            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
              Digitalize checklists, acompanhe não conformidades em tempo real e mantenha sua operação sob controle total.
            </p>

            {/* Destaques operacionais */}
            <div className="mt-8 space-y-3 hidden sm:block">
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Rastreabilidade completa de vistorias por veículo e condutor</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <AlertOctagon className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Tratativa ágil de Não Conformidades com níveis de severidade</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <Truck className="h-4 w-4 text-blue-400 shrink-0" />
                <span>Organização por centros de custo e agrupamentos de frota</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>CHECK-ON Plataforma SaaS</span>
          <span>© {new Date().getFullYear()} Todos os direitos reservados</span>
        </div>
      </div>

      {/* Área de Autenticação */}
      <div className="w-full lg:w-[480px] xl:w-[520px] bg-white flex flex-col justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm mx-auto">
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Acesse sua conta</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Entre com suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">E-mail corporativo</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu.email@empresa.com.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white text-slate-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white text-slate-900"
              />
            </div>
            
            {error && (
              <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-start gap-2 animate-in fade-in duration-200">
                <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white" 
              disabled={loading || !email || !password}
            >
              {loading ? (
                'Entrando...'
              ) : (
                <span className="flex items-center justify-center">
                  Entrar na Plataforma
                  <ArrowRight className="h-4 w-4 ml-2" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Acesso exclusivo para colaboradores e gestores autorizados.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
