'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, CreditCard, Shield, Settings2, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { clearSession, getStoredUser, setLoginNotice } from '@/lib/session';

type Company = {
  id: string;
  name: string;
  cnpj: string | null;
  plan: string;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
  autoBlockCriticalNc: boolean;
  sessionsRevokedAt: string | null;
  storageUsed: string | number;
  createdAt: string;
  _count: { users: number; vehicles: number; employees: number; checklists: number };
};

type CompanyForm = { name: string; cnpj: string; address: string; contactEmail: string; phone: string };

const PLAN_LABELS: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' };
const TABS = [
  { id: 'company', label: 'Dados da Empresa', icon: Building2 },
  { id: 'preferences', label: 'Preferências', icon: Settings2 },
  { id: 'plan', label: 'Plano e Uso', icon: CreditCard },
  { id: 'security', label: 'Segurança', icon: Shield },
] as const;

function formatCnpj(cnpj: string | null) {
  if (!cnpj || cnpj.length !== 14) return cnpj ?? '';
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatBytes(value: string | number) {
  const bytes = Number(value) || 0;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toForm(company: Company): CompanyForm {
  return {
    name: company.name,
    cnpj: formatCnpj(company.cnpj),
    address: company.address ?? '',
    contactEmail: company.contactEmail ?? '',
    phone: company.phone ?? '',
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('company');
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>({ name: '', cnpj: '', address: '', contactEmail: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    // Só o administrador altera; o gestor consulta.
    const role = getStoredUser()?.role;
    setCanEdit(role === 'ADMIN_EMPRESA' || role === 'SUPER_ADMIN');
    fetchCompany();
  }, []);

  async function fetchCompany() {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get<Company>('/company');
      setCompany(res.data);
      setForm(toForm(res.data));
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar os dados da empresa.'));
    } finally {
      setLoading(false);
    }
  }

  async function save(data: Partial<Omit<Company, 'cnpj'>> & { cnpj?: string | null }, okText: string) {
    try {
      setSaving(true);
      setMessage(null);
      const res = await api.patch<Company>('/company', data);
      setCompany(res.data);
      setForm(toForm(res.data));
      // O nome da empresa aparece na barra lateral: atualiza a sessão guardada.
      const stored = getStoredUser();
      if (stored && !stored.impersonating && stored.tenantName !== res.data.name) {
        localStorage.setItem('user', JSON.stringify({ ...stored, tenantName: res.data.name }));
      }
      setMessage({ kind: 'ok', text: okText });
    } catch (error) {
      setMessage({ kind: 'error', text: apiErrorMessage(error, 'Não foi possível salvar.') });
    } finally {
      setSaving(false);
    }
  }

  function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    save(
      { name: form.name, cnpj: form.cnpj || null, address: form.address, contactEmail: form.contactEmail, phone: form.phone },
      'Dados da empresa salvos.',
    );
  }

  async function handleRevokeSessions() {
    if (!window.confirm('Encerrar todas as sessões da empresa? Todos os usuários, inclusive você e os motoristas no aplicativo, precisarão entrar de novo.')) return;
    try {
      setSaving(true);
      await api.post('/company/revoke-sessions');
      // A sua própria sessão também foi encerrada.
      clearSession();
      setLoginNotice('Todas as sessões da empresa foram encerradas. Entre novamente.');
      window.location.assign('/login');
    } catch (error) {
      setMessage({ kind: 'error', text: apiErrorMessage(error, 'Não foi possível encerrar as sessões.') });
      setSaving(false);
    }
  }

  const field = (key: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dados da sua empresa, regras de operação, plano e segurança dos acessos.
          </p>
        </div>
        {message && (
          <div
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-lg border ${
              message.kind === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {message.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {message.text}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center">
          <Activity className="h-8 w-8 animate-pulse text-emerald-600 mb-2" />
          Carregando configurações...
        </div>
      ) : loadError || !company ? (
        <div role="alert" className="p-10 text-center text-sm">
          <p className="text-rose-700 mb-3">{loadError || 'Empresa não encontrada.'}</p>
          <Button variant="outline" size="sm" onClick={fetchCompany}>Tentar de novo</Button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 shrink-0">
            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setMessage(null); }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      active ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1 min-w-0">
            {!canEdit && (
              <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Você pode consultar estas informações. Alterações são feitas pelo administrador da empresa.
              </p>
            )}

            {activeTab === 'company' && (
              <Card className="border-slate-200 shadow-sm">
                <form onSubmit={handleSaveCompany}>
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="text-lg text-slate-800">Dados da Empresa</CardTitle>
                    <CardDescription>Nome e contatos da empresa no CHECK-ON.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <fieldset disabled={!canEdit || saving} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Nome da empresa *</Label>
                        <Input id="companyName" value={form.name} onChange={field('name')} className="bg-slate-50" required maxLength={120} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input id="cnpj" value={form.cnpj} onChange={field('cnpj')} className="bg-slate-50" inputMode="numeric" placeholder="00.000.000/0000-00" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Input id="address" value={form.address} onChange={field('address')} className="bg-slate-50" maxLength={200} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail">E-mail de contato</Label>
                        <Input id="contactEmail" type="email" value={form.contactEmail} onChange={field('contactEmail')} className="bg-slate-50" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input id="phone" value={form.phone} onChange={field('phone')} className="bg-slate-50" maxLength={30} />
                      </div>
                    </fieldset>
                  </CardContent>
                  {canEdit && (
                    <CardFooter className="border-t border-slate-100 pt-4 bg-slate-50/50 flex justify-end">
                      <Button type="submit" className="shadow-sm" disabled={saving}>
                        <Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar alterações'}
                      </Button>
                    </CardFooter>
                  )}
                </form>
              </Card>
            )}

            {activeTab === 'preferences' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-slate-800">Regras de Operação</CardTitle>
                  <CardDescription>Como o sistema reage às não conformidades apontadas nas inspeções.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800">Bloquear veículo com NC crítica</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">
                        Ligado: uma NC crítica ativa deixa o veículo <strong>Bloqueado</strong> até ser resolvida.
                        Desligado: o veículo fica em <strong>Atenção</strong> e pode continuar operando.
                        Vale para as próximas inspeções e tratativas.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        aria-label="Bloquear veículo com NC crítica"
                        checked={company.autoBlockCriticalNc}
                        disabled={!canEdit || saving}
                        onChange={() => {
                          const next = !company.autoBlockCriticalNc;
                          if (!next && !window.confirm('Desligar o bloqueio automático? Veículos com NC crítica poderão continuar rodando.')) return;
                          save({ autoBlockCriticalNc: next }, next ? 'Bloqueio automático ligado.' : 'Bloqueio automático desligado.');
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-disabled:opacity-50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'plan' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-slate-800">Plano e Uso</CardTitle>
                  <CardDescription>Cliente desde {format(new Date(company.createdAt), 'dd/MM/yyyy')}.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Plano atual</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{PLAN_LABELS[company.plan] ?? company.plan}</p>
                    <p className="text-xs text-slate-600 mt-2">Para mudar de plano ou tirar dúvidas sobre cobrança, fale com o suporte do CHECK-ON.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Veículos', value: company._count.vehicles },
                      { label: 'Colaboradores', value: company._count.employees },
                      { label: 'Usuários', value: company._count.users },
                      { label: 'Inspeções', value: company._count.checklists },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className="text-xl font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Fotos armazenadas: {formatBytes(company.storageUsed)}.</p>
                </CardContent>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card className="border-rose-200 shadow-sm">
                <CardHeader className="border-b border-rose-100 bg-rose-50/30 pb-4">
                  <CardTitle className="text-lg text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                    Encerrar todas as sessões
                  </CardTitle>
                  <CardDescription>Use se suspeitar que uma senha vazou ou que um aparelho foi perdido.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-slate-600">
                    Todos os usuários da empresa saem do painel e do aplicativo em até 30 segundos e precisam entrar de novo. Inspeções já enviadas não são afetadas.
                  </p>
                  {company.sessionsRevokedAt && (
                    <p className="text-xs text-slate-500">Última vez: {format(new Date(company.sessionsRevokedAt), "dd/MM/yyyy 'às' HH:mm")}.</p>
                  )}
                  <Button
                    variant="outline"
                    className="border-rose-300 text-rose-700 hover:bg-rose-50"
                    disabled={!canEdit || saving}
                    onClick={handleRevokeSessions}
                  >
                    Encerrar todas as sessões
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
