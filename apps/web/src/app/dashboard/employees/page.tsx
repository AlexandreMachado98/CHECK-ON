'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Search, Edit2, ShieldOff, CheckCircle2, Activity, HardHat, ShieldAlert, Wrench, User } from 'lucide-react';

const EMPLOYEE_ROLES = [
  { value: 'MOTORISTA',  label: 'Motorista' },
  { value: 'TECNICO',    label: 'Técnico' },
  { value: 'OPERADOR',   label: 'Operador' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
];

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'MOTORISTA': return <User className="mr-1.5 h-3 w-3" />;
    case 'TECNICO': return <Wrench className="mr-1.5 h-3 w-3" />;
    case 'OPERADOR': return <HardHat className="mr-1.5 h-3 w-3" />;
    case 'SUPERVISOR': return <ShieldAlert className="mr-1.5 h-3 w-3" />;
    default: return <User className="mr-1.5 h-3 w-3" />;
  }
};

const ROLE_COLOR: Record<string, string> = {
  MOTORISTA:  'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  TECNICO:    'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
  OPERADOR:   'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  SUPERVISOR: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
};

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

function EmployeeForm({ initial = EMPTY_FORM, onSubmit, onCancel, submitting, mode }: { initial?: EmployeeFormData; onSubmit: (data: EmployeeFormData) => Promise<void>; onCancel: () => void; submitting: boolean; mode: 'create' | 'edit'; }) {
  const [form, setForm] = useState<EmployeeFormData>(initial);

  function set(field: keyof EmployeeFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  return (
    <form onSubmit={async (e) => { e.preventDefault(); await onSubmit(form); }} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="emp-name">Nome Completo *</Label>
        <Input id="emp-name" value={form.name} onChange={set('name')} required placeholder="Ex: João da Silva" />
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
        <Input id="emp-email" type="email" value={form.email} onChange={set('email')} placeholder="colaborador@empresa.com.br" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emp-role">Cargo / Função *</Label>
        <Select value={form.role} onValueChange={(val) => setForm(prev => ({ ...prev, role: val || '' }))} required>
          <SelectTrigger id="emp-role">
            <SelectValue placeholder="Selecione o cargo na operação" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYEE_ROLES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !form.name || !form.role}>
          {submitting ? 'Processando...' : mode === 'create' ? 'Cadastrar Colaborador' : 'Salvar Alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSub] = useState(false);

  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editSubmitting, setEditSub] = useState(false);

  useEffect(() => { fetchEmployees(); }, []);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const res = await api.get<Employee[]>('/employees');
      setEmployees(res.data);
    } catch {
      console.error('Falha ao carregar colaboradores');
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
      alert('Erro ao alterar situação do colaborador.');
    }
  }

  const roleLabelMap = Object.fromEntries(EMPLOYEE_ROLES.map(r => [r.value, r.label]));

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Colaboradores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie motoristas, técnicos e operadores da operação.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Colaborador</DialogTitle>
              <DialogDescription>
                Insira os dados do profissional que atuará em campo ou nos checklists.
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Relação de Colaboradores</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input type="text" placeholder="Buscar por nome ou CPF..." className="pl-9 h-9 text-sm bg-slate-50" disabled />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Buscando colaboradores...
            </div>
          ) : employees.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <Users className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum colaborador encontrado</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-5">
                Não há profissionais registrados. Comece cadastrando os motoristas para que possam acessar o aplicativo.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar colaborador
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[30%]">Nome</TableHead>
                  <TableHead className="w-[20%]">Cargo</TableHead>
                  <TableHead className="w-[20%] hidden md:table-cell">Contato</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="text-right w-[15%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="font-medium text-slate-900">{emp.name}</div>
                      {emp.cpf && <div className="text-xs text-slate-500 mt-0.5">{emp.cpf}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-medium shadow-sm ${ROLE_COLOR[emp.role] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {getRoleIcon(emp.role)}
                        {roleLabelMap[emp.role] ?? emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm text-slate-600">{emp.email || 'Sem e-mail'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{emp.phone || 'Sem telefone'}</div>
                    </TableCell>
                    <TableCell>
                      {emp.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium">
                          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                          Regular
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 font-medium">
                          <ShieldOff className="mr-1 h-3 w-3 text-slate-400" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => setEditTarget(emp)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${emp.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleToggleActive(emp)}
                          title={emp.isActive ? "Inativar" : "Reativar"}
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
              <DialogTitle>Editar Colaborador</DialogTitle>
              <DialogDescription>
                Atualize as informações de <strong>{editTarget.name}</strong>.
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
