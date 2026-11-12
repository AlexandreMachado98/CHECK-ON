'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Building2, CheckCircle2, History, LogIn, Plus, Power, Search, ShieldOff, Truck, Users } from 'lucide-react';
import api, { ensureList } from '@/lib/api';
import { apiErrorMessage, type AdminAccessLog, type AuthUser, type Tenant } from '@/lib/types';
import { startTenantAccess } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PLANS = [
  { value: 'STARTER', label: 'Starter' },
  { value: 'PRO', label: 'Pro' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];
const planLabel = (plan: string) => PLANS.find((p) => p.value === plan)?.label ?? plan;

function formatCnpj(cnpj: string | null) {
  if (!cnpj || cnpj.length !== 14) return cnpj ?? '—';
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

type TenantForm = {
  name: string;
  cnpj: string;
  plan: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};
const EMPTY_FORM: TenantForm = { name: '', cnpj: '', plan: 'STARTER', adminName: '', adminEmail: '', adminPassword: '' };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TenantForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ tenant: string; email: string } | null>(null);

  const [toggleTarget, setToggleTarget] = useState<Tenant | null>(null);
  const [toggleError, setToggleError] = useState('');
  const [toggling, setToggling] = useState(false);

  const [accessingId, setAccessingId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState('');
  const [accessExpired, setAccessExpired] = useState(false);
  const [accessLogs, setAccessLogs] = useState<AdminAccessLog[]>([]);

  useEffect(() => {
    fetchTenants();
    fetchAccessLogs();
    // Chegou aqui porque o acesso de 1 hora a uma empresa expirou.
    if (new URLSearchParams(window.location.search).get('acesso') === 'expirado') {
      setAccessExpired(true);
      window.history.replaceState(null, '', '/dashboard/tenants');
    }
  }, []);

  async function fetchAccessLogs() {
    try {
      const res = await api.get<AdminAccessLog[]>('/admin/tenants/access-logs');
      setAccessLogs(ensureList<AdminAccessLog>(res.data, 'acessos'));
    } catch (error) {
      console.error('Falha ao buscar o histórico de acessos', error);
    }
  }

  async function handleAccess(tenant: Tenant) {
    try {
      setAccessingId(tenant.id);
      setAccessError('');
      const res = await api.post<{ access_token: string; user: AuthUser }>(`/admin/tenants/${tenant.id}/access`);
      startTenantAccess(res.data.access_token, res.data.user);
      // Recarrega a página inteira, já como administrador da empresa.
      window.location.assign('/dashboard');
    } catch (error) {
      setAccessError(apiErrorMessage(error, `Não foi possível acessar ${tenant.name}.`));
      setAccessingId(null);
    }
  }

  async function fetchTenants() {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get<Tenant[]>('/admin/tenants');
      setTenants(ensureList<Tenant>(res.data, 'empresas'));
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar as empresas.'));
    } finally {
      setLoading(false);
    }
  }

  function field(name: keyof TenantForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [name]: e.target.value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError('');
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError('');
      await api.post('/admin/tenants', {
        name: form.name,
        cnpj: form.cnpj || undefined,
        plan: form.plan,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setCreateOpen(false);
      setCreated({ tenant: form.name.trim(), email: form.adminEmail.trim().toLowerCase() });
      fetchTenants();
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Não foi possível cadastrar a empresa.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return;
    try {
      setToggling(true);
      setToggleError('');
      await api.patch(`/admin/tenants/${toggleTarget.id}`, { isActive: !toggleTarget.isActive });
      setToggleTarget(null);
      fetchTenants();
    } catch (error) {
      setToggleError(apiErrorMessage(error, 'Não foi possível alterar a empresa.'));
    } finally {
      setToggling(false);
    }
  }

  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const filtered = tenants.filter(
    (t) => !term || t.name.toLowerCase().includes(term) || (digits && t.cnpj?.includes(digits)),
  );
  const canSubmit =
    form.name.trim() && form.adminName.trim() && form.adminEmail.trim() && form.adminPassword.length >= 8;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Empresas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Clientes da plataforma. Cada empresa vê apenas os próprios veículos, inspeções e usuários.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova empresa
        </Button>
      </div>

      {accessExpired && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>O acesso de 1 hora à empresa expirou e você voltou para a plataforma. Clique em <strong>Acessar</strong> para entrar de novo.</p>
          <button type="button" className="text-amber-800 hover:underline shrink-0" onClick={() => setAccessExpired(false)}>Fechar</button>
        </div>
      )}

      {accessError && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{accessError}</p>
          <button type="button" className="hover:underline shrink-0" onClick={() => setAccessError('')}>Fechar</button>
        </div>
      )}

      {created && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p>
            <strong>{created.tenant}</strong> foi cadastrada. O administrador já pode entrar no painel com o e-mail{' '}
            <strong>{created.email}</strong> e a senha definida no cadastro.
          </p>
          <button type="button" className="text-emerald-700 hover:underline shrink-0" onClick={() => setCreated(null)}>
            Fechar
          </button>
        </div>
      )}

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-slate-400" />
              {tenants.length} {tenants.length === 1 ? 'empresa' : 'empresas'}
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou CNPJ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Carregando empresas...</div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm">
              <p className="text-rose-700 mb-3">{loadError}</p>
              <Button variant="outline" size="sm" onClick={fetchTenants}>Tentar de novo</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {tenants.length === 0 ? 'Nenhuma empresa cadastrada.' : 'Nenhuma empresa encontrada nesta busca.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="hidden md:table-cell">Plano</TableHead>
                    <TableHead className="hidden sm:table-cell">Uso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <p className="font-medium text-slate-900">
                          {t.name}
                          {t.isPlatform && <span className="ml-2 text-[11px] font-semibold text-emerald-700">plataforma</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          CNPJ {formatCnpj(t.cnpj)} · desde {format(new Date(t.createdAt), 'dd/MM/yyyy')}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-700">{planLabel(t.plan)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex gap-3 text-xs text-slate-600">
                          <span className="flex items-center" title="Usuários do painel e do app">
                            <Users className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            {t._count.users}
                          </span>
                          <span className="flex items-center" title="Veículos">
                            <Truck className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            {t._count.vehicles}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium">
                            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 font-medium">
                            <ShieldOff className="mr-1 h-3 w-3 text-slate-400" />
                            Desativada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!t.isPlatform && (
                          <div className="flex justify-end gap-2">
                          {t.isActive && (
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={accessingId !== null}
                              onClick={() => handleAccess(t)}
                              title="Entrar no painel desta empresa como administrador"
                            >
                              <LogIn className="h-3.5 w-3.5 mr-1.5" />
                              {accessingId === t.id ? 'Entrando...' : 'Acessar'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs bg-white"
                            onClick={() => {
                              setToggleError('');
                              setToggleTarget(t);
                            }}
                          >
                            <Power className="h-3.5 w-3.5 mr-1.5" />
                            {t.isActive ? 'Desativar' : 'Reativar'}
                          </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {accessLogs.length > 0 && (
        <Card className="mt-6 shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-base font-semibold flex items-center text-slate-700">
              <History className="h-4 w-4 mr-2 text-slate-400" />
              Acessos às empresas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y text-sm">
              {accessLogs.slice(0, 10).map((log) => (
                <li key={log.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-800">
                    <strong>{log.adminUser.name}</strong> entrou em <strong>{log.tenant.name}</strong>
                  </span>
                  <span className="text-xs text-slate-500">
                    {format(new Date(log.createdAt), "dd/MM/yyyy 'às' HH:mm")}{log.ip ? ` · IP ${log.ip}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
            <DialogDescription>
              A empresa já nasce com os perfis padrão e com o primeiro administrador, que cadastra os demais usuários.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="t-name">Nome da empresa *</Label>
              <Input id="t-name" value={form.name} onChange={field('name')} required placeholder="Ex: Transportes Silva" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-cnpj">CNPJ</Label>
                <Input id="t-cnpj" value={form.cnpj} onChange={field('cnpj')} inputMode="numeric" placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-plan">Plano</Label>
                <Select items={PLANS} value={form.plan} onValueChange={(value) => setForm((prev) => ({ ...prev, plan: (value as string) || 'STARTER' }))}>
                  <SelectTrigger id="t-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">Administrador da empresa</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-admin-name">Nome *</Label>
                  <Input id="t-admin-name" value={form.adminName} onChange={field('adminName')} required placeholder="Ex: Maria Santos" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-admin-email">E-mail de acesso *</Label>
                  <Input id="t-admin-email" type="email" value={form.adminEmail} onChange={field('adminEmail')} required placeholder="maria@empresa.com.br" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-admin-password">Senha inicial * (mín. 8 caracteres)</Label>
                  <Input id="t-admin-password" type="password" value={form.adminPassword} onChange={field('adminPassword')} required minLength={8} autoComplete="new-password" />
                </div>
              </div>
            </div>

            {formError && <p className="text-sm text-rose-700">{formError}</p>}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting || !canSubmit}>
                {submitting ? 'Cadastrando...' : 'Cadastrar empresa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{toggleTarget?.isActive ? 'Desativar empresa' : 'Reativar empresa'}</DialogTitle>
            <DialogDescription>
              {toggleTarget?.isActive
                ? `Os usuários de ${toggleTarget?.name} não conseguirão mais entrar no painel nem no aplicativo. Os dados ficam guardados.`
                : `Os usuários ativos de ${toggleTarget?.name} voltam a poder entrar.`}
            </DialogDescription>
          </DialogHeader>
          {toggleError && <p className="text-sm text-rose-700">{toggleError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Cancelar</Button>
            <Button
              variant={toggleTarget?.isActive ? 'destructive' : 'default'}
              disabled={toggling}
              onClick={handleToggle}
            >
              {toggling ? 'Salvando...' : toggleTarget?.isActive ? 'Desativar' : 'Reativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
