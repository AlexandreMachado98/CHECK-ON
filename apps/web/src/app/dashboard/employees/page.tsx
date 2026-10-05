'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Employee } from '@/lib/types';
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

const EMPLOYEE_ROLES = [
  { value: 'MOTORISTA',  label: 'Motorista' },
  { value: 'TECNICO',    label: 'Técnico' },
  { value: 'OPERADOR',   label: 'Operador' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
];

const ROLE_COLOR: Record<string, string> = {
  MOTORISTA:  'bg-blue-100 text-blue-700',
  TECNICO:    'bg-purple-100 text-purple-700',
  OPERADOR:   'bg-yellow-100 text-yellow-700',
  SUPERVISOR: 'bg-orange-100 text-orange-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Employee Form
// ─────────────────────────────────────────────────────────────────────────────
interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  role: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: '', email: '', phone: '', cpf: '', role: '',
};

interface EmployeeFormProps {
  initial?: EmployeeFormData;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  mode: 'create' | 'edit';
}

function EmployeeForm({ initial = EMPTY_FORM, onSubmit, onCancel, submitting, mode }: EmployeeFormProps) {
  const [form, setForm] = useState<EmployeeFormData>(initial);

  function set(field: keyof EmployeeFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onSubmit(form); }}
      className="space-y-4 py-4"
    >
      <div className="space-y-2">
        <Label htmlFor="emp-name">Nome Completo *</Label>
        <Input id="emp-name" value={form.name} onChange={set('name')} required placeholder="Ex: João Silva" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="emp-cpf">CPF</Label>
          <Input id="emp-cpf" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-phone">Telefone</Label>
          <Input id="emp-phone" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-0000" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emp-email">E-mail</Label>
        <Input id="emp-email" type="email" value={form.email} onChange={set('email')} placeholder="colaborador@empresa.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emp-role">Cargo *</Label>
        <Select
          value={form.role}
          onValueChange={(val) => setForm(prev => ({ ...prev, role: val || '' }))}
          required
        >
          <SelectTrigger id="emp-role">
            <SelectValue placeholder="Selecione o cargo" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYEE_ROLES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !form.name || !form.role}>
          {submitting ? 'Salvando...' : mode === 'create' ? 'Cadastrar Colaborador' : 'Salvar Alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Create dialog
  const [createOpen, setCreateOpen]     = useState(false);
  const [createSubmitting, setCreateSub] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget]     = useState<Employee | null>(null);
  const [editSubmitting, setEditSub]    = useState(false);

  useEffect(() => { fetchEmployees(); }, []);

  async function fetchEmployees() {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<Employee[]>('/employees');
      setEmployees(res.data);
    } catch {
      setError('Não foi possível carregar os colaboradores. Verifique a conexão com a API.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: EmployeeFormData) {
    try {
      setCreateSub(true);
      await api.post('/employees', data);
      setCreateOpen(false);
      fetchEmployees();
    } catch {
      alert('Erro ao cadastrar colaborador.');
    } finally {
      setCreateSub(false);
    }
  }

  async function handleEdit(data: EmployeeFormData) {
    if (!editTarget) return;
    try {
      setEditSub(true);
      await api.patch(`/employees/${editTarget.id}`, data);
      setEditTarget(null);
      fetchEmployees();
    } catch {
      alert('Erro ao atualizar colaborador.');
    } finally {
      setEditSub(false);
    }
  }

  async function handleToggleActive(emp: Employee) {
    try {
      await api.patch(`/employees/${emp.id}`, { isActive: !emp.isActive });
      fetchEmployees();
    } catch {
      alert('Erro ao alterar status.');
    }
  }

  const roleLabelMap = Object.fromEntries(EMPLOYEE_ROLES.map(r => [r.value, r.label]));

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie motoristas, técnicos e operadores da empresa
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button>Novo Colaborador</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Colaborador</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo colaborador. Campos com * são obrigatórios.
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm
              mode="create"
              submitting={createSubmitting}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card className="mt-2">
        <CardHeader>
          <CardTitle>Listagem de Colaboradores</CardTitle>
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
                  <TableHead>Cargo</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      Nenhum colaborador cadastrado. Clique em &quot;Novo Colaborador&quot; para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLOR[emp.role] ?? 'bg-gray-100 text-gray-700'}>
                          {roleLabelMap[emp.role] ?? emp.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{emp.email ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.phone ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={emp.isActive ? 'default' : 'secondary'}
                          className={emp.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100'}
                        >
                          {emp.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTarget(emp)}
                        >
                          Editar
                        </Button>
                        {/* Toggle active */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={emp.isActive ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
                          onClick={() => handleToggleActive(emp)}
                        >
                          {emp.isActive ? 'Desativar' : 'Ativar'}
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

      {/* Edit Dialog (controlled externally) */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Colaborador</DialogTitle>
              <DialogDescription>
                Atualize os dados de <strong>{editTarget.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm
              mode="edit"
              initial={{
                name:  editTarget.name,
                email: editTarget.email ?? '',
                phone: editTarget.phone ?? '',
                cpf:   editTarget.cpf   ?? '',
                role:  editTarget.role,
              }}
              submitting={editSubmitting}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
