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
import { Users, Plus, Search, Edit2, ShieldOff, CheckCircle2, Activity, HardHat, ShieldAlert, Wrench, User, Hash } from 'lucide-react';

const EMPLOYEE_ROLES = [
  { value: 'MOTORISTA',  label: 'Motorista' },
  { value: 'TECNICO',    label: 'Técnico de Manutenção' },
  { value: 'OPERADOR',   label: 'Operador de Frota' },
  { value: 'SUPERVISOR', label: 'Supervisor Operacional' },
];

const getRoleIcon = (role?: string) => {
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
  TECNICO:    'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  OPERADOR:   'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  SUPERVISOR: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
};

interface EmployeeFormData {
  name: string;
  matricula: string;
  jobTitle: string;
  email: string;
  phone: string;
  cpf: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: '', matricula: '', jobTitle: 'MOTORISTA', email: '', phone: '', cpf: '',
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
        <Input 
          id="emp-name" 
          value={form.name} 
          onChange={set('name')} 
          required 
          placeholder="Ex: Carlos Eduardo de Souza" 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="emp-matricula" className="flex items-center gap-1">
            <Hash className="h-3.5 w-3.5 text-slate-400" />
            Matrícula do Colaborador *
          </Label>
          <Input 
            id="emp-matricula" 
            value={form.matricula} 
            onChange={set('matricula')} 
            required 
            placeholder="Ex: MAT-2024-089" 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-jobTitle">Função / Cargo *</Label>
          <Select 
            value={form.jobTitle} 
            onValueChange={(val) => setForm(prev => ({ ...prev, jobTitle: val || '' }))} 
            required
          >
            <SelectTrigger id="emp-jobTitle">
              <SelectValue placeholder="Selecione a função" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className="space-y-2">
          <Label htmlFor="emp-cpf">CPF (Opcional)</Label>
          <Input id="emp-cpf" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-phone">Telefone / WhatsApp</Label>
          <Input id="emp-phone" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-0000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-email">E-mail</Label>
          <Input id="emp-email" type="email" value={form.email} onChange={set('email')} placeholder="carlos@empresa.com" />
        </div>
      </div>

      <DialogFooter className="mt-6 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !form.name.trim() || !form.matricula.trim() || !form.jobTitle}>
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
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

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
      await api.post('/employees', {
        name: data.name.trim(),
        matricula: data.matricula.trim(),
        jobTitle: data.jobTitle,
        cpf: data.cpf.trim() || undefined,
        phone: data.phone.trim() || undefined,
        email: data.email.trim() || undefined,
      });
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
      await api.patch(`/employees/${editTarget.id}`, {
        name: data.name.trim(),
        matricula: data.matricula.trim(),
        jobTitle: data.jobTitle,
        cpf: data.cpf.trim() || undefined,
        phone: data.phone.trim() || undefined,
        email: data.email.trim() || undefined,
      });
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

  const filteredEmployees = employees.filter(emp => {
    const currentJob = emp.jobTitle || emp.role || '';
    const currentMatricula = emp.matricula || '';
    const matchesSearch = 
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      currentMatricula.toLowerCase().includes(search.toLowerCase()) ||
      (emp.cpf && emp.cpf.includes(search)) ||
      (emp.email && emp.email.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || currentJob === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Colaboradores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie motoristas, técnicos e operadores pelo nome, função e matrícula.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Colaborador</DialogTitle>
              <DialogDescription>
                Informe o nome, função e matrícula do profissional para habilitar seu acesso aos checklists.
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
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-700">Relação de Colaboradores</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Buscar por nome ou matrícula..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50" 
              />
            </div>
            <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val || 'ALL')}>
              <SelectTrigger className="h-9 w-40 text-xs bg-slate-50">
                <SelectValue placeholder="Todas as funções" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as funções</SelectItem>
                {EMPLOYEE_ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                Não há profissionais registrados. Cadastre os colaboradores (Nome, Função e Matrícula) para vincular às inspeções.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar colaborador
              </Button>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhum colaborador encontrado para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[30%]">Nome do Colaborador</TableHead>
                  <TableHead className="w-[18%]">Matrícula</TableHead>
                  <TableHead className="w-[22%]">Função / Cargo</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="text-right w-[15%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const job = emp.jobTitle || emp.role || 'MOTORISTA';
                  return (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{emp.name}</div>
                        {emp.cpf && <div className="text-xs text-slate-500 mt-0.5">CPF: {emp.cpf}</div>}
                      </TableCell>
                      <TableCell>
                        {emp.matricula ? (
                          <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-200">
                            {emp.matricula}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Não informada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-medium shadow-sm ${ROLE_COLOR[job] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {getRoleIcon(job)}
                          {roleLabelMap[job] ?? job}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium">
                            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                            Ativo
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Colaborador</DialogTitle>
              <DialogDescription>
                Atualize as informações de <strong>{editTarget.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm
              mode="edit"
              initial={{
                name:      editTarget.name,
                matricula: editTarget.matricula ?? '',
                jobTitle:  editTarget.jobTitle ?? editTarget.role ?? 'MOTORISTA',
                email:     editTarget.email ?? '',
                phone:     editTarget.phone ?? '',
                cpf:       editTarget.cpf   ?? '',
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

