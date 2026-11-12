'use client';

import { useEffect, useState } from 'react';
import api, { ensureList } from '@/lib/api';
import { apiErrorMessage, type Employee, type User, type Role } from '@/lib/types';
import { roleLabel } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Plus, Search, Edit2, ShieldOff, CheckCircle2, Activity, Key } from 'lucide-react';

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  /** 'none' = sem colaborador vinculado. */
  employeeId: string;
}

const NO_EMPLOYEE = 'none';
const EMPTY_FORM: UserFormData = { name: '', email: '', password: '', roleId: '', employeeId: NO_EMPLOYEE };

/** Envia null para desfazer o vínculo e omite o campo quando não há colaborador no cadastro novo. */
function employeeIdPayload(value: string) {
  return value === NO_EMPLOYEE ? null : value;
}

function UserForm({ initial = EMPTY_FORM, roles, employees, onSubmit, onCancel, submitting, mode, error }: { initial?: Partial<UserFormData>; roles: Role[]; employees: Employee[]; onSubmit: (data: UserFormData) => Promise<void>; onCancel: () => void; submitting: boolean; mode: 'create' | 'edit'; error?: string; }) {
  const [form, setForm] = useState<UserFormData>({ ...EMPTY_FORM, ...initial });

  function set(field: keyof UserFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  const canSubmit = form.name && form.email && form.roleId && (mode === 'edit' ? !form.password || form.password.length >= 8 : !!form.password && form.password.length >= 8);

  return (
    <form onSubmit={async (e) => { e.preventDefault(); await onSubmit(form); }} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="u-name">Nome Completo *</Label>
        <Input id="u-name" value={form.name} onChange={set('name')} required placeholder="Ex: Maria Santos" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-email">E-mail de Acesso *</Label>
        <Input id="u-email" type="email" value={form.email} onChange={set('email')} required disabled={mode === 'edit'} placeholder="usuario@empresa.com.br" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-password">
          {mode === 'edit' ? 'Nova senha (deixe em branco para manter; mín. 8 caracteres)' : 'Senha inicial * (mín. 8 caracteres)'}
        </Label>
        <Input
          id="u-password"
          type="password"
          value={form.password}
          onChange={set('password')}
          required={mode === 'create'}
          placeholder={mode === 'edit' ? 'Não alterar senha' : '••••••••'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-role">Perfil de Acesso *</Label>
        <Select items={roles.map(r => ({ value: r.id, label: r.label }))} value={form.roleId} onValueChange={(val) => setForm(prev => ({ ...prev, roleId: (val as string) || '' }))} required>
          <SelectTrigger id="u-role">
            <SelectValue placeholder="Selecione o nível de permissão" />
          </SelectTrigger>
          <SelectContent>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-employee">Colaborador vinculado</Label>
        <Select
          items={[{ value: NO_EMPLOYEE, label: 'Nenhum' }, ...employees.map(e => ({ value: e.id, label: e.matricula ? `${e.name} (${e.matricula})` : e.name }))]}
          value={form.employeeId}
          onValueChange={(val) => setForm(prev => ({ ...prev, employeeId: (val as string) || NO_EMPLOYEE }))}
        >
          <SelectTrigger id="u-employee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_EMPLOYEE}>Nenhum</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.matricula ? `${e.name} (${e.matricula})` : e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">Obrigatório para motoristas e supervisores registrarem checklists no aplicativo.</p>
      </div>

      {roles.length === 0 && <p className="text-xs text-amber-700">Não foi possível carregar os perfis. Feche e abra de novo.</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? 'Processando...' : mode === 'create' ? 'Conceder Acesso' : 'Salvar Alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createSub, setCreateSub] = useState(false);

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editSub, setEditSub] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const res = await api.get<Employee[]>('/employees');
      setEmployees(ensureList<Employee>(res.data, 'colaboradores').filter(e => e.isActive));
    } catch (error) {
      console.error('Falha ao buscar colaboradores', error);
    }
  }

  async function fetchUsers() {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get<User[]>('/users');
      setUsers(ensureList<User>(res.data, 'usuários'));
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar os usuários.'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      // Só os perfis que quem está logado pode atribuir (gestor não cria administrador).
      const res = await api.get<Role[]>('/roles');
      setRoles(ensureList<Role>(res.data, 'perfis'));
    } catch (error) {
      console.error('Falha ao buscar perfis', error);
      setRoles([]);
    }
  }

  async function handleCreate(data: UserFormData) {
    try {
      setCreateSub(true);
      setFormError('');
      const { employeeId, ...rest } = data;
      const linked = employeeIdPayload(employeeId);
      await api.post('/users', linked ? { ...rest, employeeId: linked } : rest);
      setCreateOpen(false);
      fetchUsers();
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Não foi possível criar o usuário.'));
    } finally {
      setCreateSub(false);
    }
  }

  async function handleEdit(data: UserFormData) {
    if (!editTarget) return;
    try {
      setEditSub(true);
      setFormError('');
      const payload: Partial<UserFormData> = { name: data.name };
      if (data.roleId !== editTarget.roleId) payload.roleId = data.roleId;
      const linked = employeeIdPayload(data.employeeId);
      if (linked !== (editTarget.employeeId ?? null)) (payload as Record<string, unknown>).employeeId = linked;
      if (data.password) payload.password = data.password;
      await api.patch(`/users/${editTarget.id}`, payload);
      setEditTarget(null);
      fetchUsers();
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Não foi possível atualizar o usuário.'));
    } finally {
      setEditSub(false);
    }
  }

  async function handleToggle(user: User) {
    try {
      setActionError('');
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Não foi possível alterar o acesso deste usuário.'));
    }
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Usuários de Acesso</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie quem tem permissão para acessar o painel de administração e relatórios.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (open) setFormError(''); }}>
          <DialogTrigger>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Conceder Acesso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>
                Gestores e administradores usam o painel; supervisores e motoristas usam o aplicativo.
              </DialogDescription>
            </DialogHeader>
            <UserForm
              mode="create"
              roles={roles}
              employees={employees}
              submitting={createSub}
              error={formError}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {actionError && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <p>{actionError}</p>
          <button type="button" className="shrink-0 hover:underline" onClick={() => setActionError('')}>Fechar</button>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Contas do Sistema</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Pesquisar por nome ou e-mail..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50" 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Buscando usuários autorizados...
            </div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm">
              <p className="text-rose-700 mb-3">{loadError}</p>
              <Button variant="outline" size="sm" onClick={fetchUsers}>Tentar de novo</Button>
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <ShieldCheck className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum acesso configurado</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-5">
                Não existem contas de acesso adicionais. Você pode convidar gestores e auditores.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar acesso
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhum usuário encontrado para a busca &quot;{search}&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[30%]">Usuário</TableHead>
                  <TableHead className="w-[25%] hidden sm:table-cell">E-mail</TableHead>
                  <TableHead className="w-[20%] hidden md:table-cell">Perfil</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="text-right w-[10%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900">{u.name}</TableCell>
                    <TableCell className="text-slate-600 hidden sm:table-cell">
                      {u.email}
                      {u.employee && <span className="block text-xs text-slate-400">Colaborador: {u.employee.name}</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="inline-flex items-center text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        <Key className="h-3 w-3 mr-1.5 text-slate-400" />
                        {u.role?.label ?? roleLabel(u.role?.name)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium">
                          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                          Permitido
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 font-medium">
                          <ShieldOff className="mr-1 h-3 w-3 text-slate-400" />
                          Bloqueado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => { setFormError(''); setEditTarget(u); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${u.isActive ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleToggle(u)}
                          title={u.isActive ? "Bloquear Acesso" : "Desbloquear Acesso"}
                        >
                          <ShieldOff className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Acesso</DialogTitle>
              <DialogDescription>
                Atualize as permissões ou redefina a senha de <strong>{editTarget.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <UserForm
              mode="edit"
              roles={roles}
              employees={employees}
              initial={{ name: editTarget.name, email: editTarget.email, roleId: editTarget.roleId, employeeId: editTarget.employeeId ?? NO_EMPLOYEE }}
              submitting={editSub}
              error={formError}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
