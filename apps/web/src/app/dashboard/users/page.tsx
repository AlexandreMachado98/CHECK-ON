'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { User, Role } from '@/lib/types';
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
}

const EMPTY_FORM: UserFormData = { name: '', email: '', password: '', roleId: '' };

function UserForm({ initial = EMPTY_FORM, roles, onSubmit, onCancel, submitting, mode }: { initial?: Partial<UserFormData>; roles: Role[]; onSubmit: (data: UserFormData) => Promise<void>; onCancel: () => void; submitting: boolean; mode: 'create' | 'edit'; }) {
  const [form, setForm] = useState<UserFormData>({ ...EMPTY_FORM, ...initial });

  function set(field: keyof UserFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  const canSubmit = form.name && form.email && form.roleId && (mode === 'edit' || (form.password && form.password.length >= 6));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); await onSubmit(form); }} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="u-name">Nome Completo *</Label>
        <Input id="u-name" value={form.name} onChange={set('name')} required placeholder="Ex: Maria Santos" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-email">E-mail de Acesso *</Label>
        <Input id="u-email" type="email" value={form.email} onChange={set('email')} required placeholder="usuario@empresa.com.br" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-password">
          {mode === 'edit' ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial * (mín. 6 caracteres)'}
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
        <Select value={form.roleId} onValueChange={(val) => setForm(prev => ({ ...prev, roleId: val || '' }))} required>
          <SelectTrigger id="u-role">
            <SelectValue placeholder="Selecione o nível de permissão" />
          </SelectTrigger>
          <SelectContent>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSub, setCreateSub] = useState(false);

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editSub, setEditSub] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch {
      console.error('Falha ao buscar usuários');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const res = await api.get('/admin/tenants');
      // For now we simulate roles until backend is ready for it
      setRoles([
        { id: '1', name: 'SUPER_ADMIN', permissions: [] },
        { id: '2', name: 'GESTOR', permissions: [] }
      ]);
    } catch (_e) {
      console.error('Sem rota de roles isolada', _e);
    }
  }

  async function handleCreate(data: UserFormData) {
    try {
      setCreateSub(true);
      await api.post('/users', data);
      setCreateOpen(false);
      fetchUsers();
    } catch {
      alert('Erro ao criar usuário.');
    } finally {
      setCreateSub(false);
    }
  }

  async function handleEdit(data: UserFormData) {
    if (!editTarget) return;
    try {
      setEditSub(true);
      const payload: Partial<UserFormData> = { name: data.name, roleId: data.roleId };
      if (data.password) payload.password = data.password;
      await api.patch(`/users/${editTarget.id}`, payload);
      setEditTarget(null);
      fetchUsers();
    } catch {
      alert('Erro ao atualizar usuário.');
    } finally {
      setEditSub(false);
    }
  }

  async function handleToggle(user: User) {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch {
      alert('Erro ao alterar status do usuário.');
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Usuários de Acesso</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie quem tem permissão para acessar o painel de administração e relatórios.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Conceder Acesso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Usuário Administrativo</DialogTitle>
              <DialogDescription>
                Forneça login e senha para um gestor ou operador de central.
              </DialogDescription>
            </DialogHeader>
            <UserForm
              mode="create"
              roles={roles}
              submitting={createSub}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Contas do Sistema</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input type="text" placeholder="Pesquisar por nome ou e-mail..." className="pl-9 h-9 text-sm bg-slate-50" disabled />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Buscando usuários autorizados...
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
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900">{u.name}</TableCell>
                    <TableCell className="text-slate-600 hidden sm:table-cell">{u.email}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="inline-flex items-center text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        <Key className="h-3 w-3 mr-1.5 text-slate-400" />
                        {u.role?.name || 'Padrão'}
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => setEditTarget(u)}>
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
              initial={{ name: editTarget.name, email: editTarget.email, roleId: editTarget.roleId }}
              submitting={editSub}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
