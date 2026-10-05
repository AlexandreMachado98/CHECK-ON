'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { User, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─────────────────────────────────────────────────────────────────────────────
// User Form
// ─────────────────────────────────────────────────────────────────────────────
interface UserFormData {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

const EMPTY_FORM: UserFormData = { name: '', email: '', password: '', roleId: '' };

interface UserFormProps {
  initial?: Partial<UserFormData>;
  roles: Role[];
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  mode: 'create' | 'edit';
}

function UserForm({ initial = EMPTY_FORM, roles, onSubmit, onCancel, submitting, mode }: UserFormProps) {
  const [form, setForm] = useState<UserFormData>({ ...EMPTY_FORM, ...initial });

  function set(field: keyof UserFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  const canSubmit = form.name && form.email && form.roleId && (mode === 'edit' || form.password.length >= 6);

  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onSubmit(form); }}
      className="space-y-4 py-4"
    >
      <div className="space-y-2">
        <Label htmlFor="u-name">Nome Completo *</Label>
        <Input id="u-name" value={form.name} onChange={set('name')} required placeholder="Ex: Maria Santos" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-email">E-mail *</Label>
        <Input id="u-email" type="email" value={form.email} onChange={set('email')} required placeholder="usuario@empresa.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-password">
          {mode === 'edit' ? 'Nova Senha (deixe em branco para manter)' : 'Senha * (mín. 6 caracteres)'}
        </Label>
        <Input
          id="u-password"
          type="password"
          value={form.password}
          onChange={set('password')}
          required={mode === 'create'}
          placeholder={mode === 'edit' ? 'Deixe em branco para não alterar' : '••••••••'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="u-role">Perfil de Acesso *</Label>
        <Select
          value={form.roleId}
          onValueChange={(val) => setForm(prev => ({ ...prev, roleId: val || '' }))}
          required
        >
          <SelectTrigger id="u-role">
            <SelectValue placeholder="Selecione o perfil" />
          </SelectTrigger>
          <SelectContent>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? 'Salvando...' : mode === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [roles, setRoles]     = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [createOpen, setCreateOpen]     = useState(false);
  const [createSub, setCreateSub]       = useState(false);
  const [editTarget, setEditTarget]     = useState<User | null>(null);
  const [editSub, setEditSub]           = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch {
      setError('Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const res = await api.get<Role[]>('/roles');
      setRoles(res.data);
    } catch {
      // non-critical: fallback to empty
    }
  }

  async function handleCreate(data: UserFormData) {
    try {
      setCreateSub(true);
      await api.post('/users', data);
      setCreateOpen(false);
      fetchUsers();
    } catch {
      alert('Erro ao criar usuário. Verifique se o e-mail já está em uso.');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie contas de acesso e perfis de permissão
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button>Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie uma conta de acesso ao painel administrativo.
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

      <Card className="mt-2">
        <CardHeader>
          <CardTitle>Listagem de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Nenhum usuário cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role?.name ?? '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={u.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100'}
                        >
                          {u.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditTarget(u)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={u.isActive
                            ? 'text-destructive hover:text-destructive'
                            : 'text-green-600 hover:text-green-600'}
                          onClick={() => handleToggle(u)}
                        >
                          {u.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Altere os dados de <strong>{editTarget.name}</strong>.
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
