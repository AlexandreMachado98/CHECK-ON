'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { apiErrorMessage, type Unit } from '@/lib/types';
import { useUnits } from '@/components/unit-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Activity, Briefcase, Edit2, Plus, Power, Trash2 } from 'lucide-react';
import { notify, confirmAction } from '@/components/feedback';

type FormState = { name: string; client: string };
const EMPTY: FormState = { name: '', client: '' };

/**
 * Frentes de trabalho / contratos. Cada frota pertence a uma frente; gestores, supervisores e
 * motoristas só veem as frentes em que estão vinculados. Só o administrador da empresa chega aqui.
 */
export default function FrentesPage() {
  const { units, loaded, reload } = useUnits();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function startEdit(unit: Unit) {
    setEditing(unit);
    setForm({ name: unit.name, client: unit.client ?? '' });
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const body = { name: form.name.trim(), client: form.client.trim() || null };
    try {
      if (editing) await api.patch(`/units/${editing.id}`, body);
      else await api.post('/units', body);
      setOpen(false);
      await reload();
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível salvar a frente de trabalho.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(unit: Unit) {
    const question = unit.isActive
      ? `Desativar a frente "${unit.name}"? Gestores, supervisores e motoristas vinculados deixam de ver as frotas, veículos, inspeções e NCs dela. Você (administrador) continua vendo tudo.`
      : `Reativar a frente "${unit.name}"? Quem está vinculado volta a ver os dados dela.`;
    if (!(await confirmAction({ message: question, title: unit.isActive ? 'Desativar frente de trabalho' : 'Reativar frente de trabalho', confirmLabel: unit.isActive ? 'Desativar' : 'Reativar', danger: unit.isActive }))) return;
    try {
      await api.patch(`/units/${unit.id}`, { isActive: !unit.isActive });
      await reload();
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível alterar a frente de trabalho.'));
    }
  }

  async function remove(unit: Unit) {
    if (!(await confirmAction({ message: `Excluir a frente "${unit.name}"? Os vínculos de colaboradores, usuários e modelos com ela serão removidos.`, title: 'Excluir frente de trabalho', confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await api.delete(`/units/${unit.id}`);
      await reload();
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível excluir a frente de trabalho.'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Frentes de trabalho</h1>
          <p className="mt-1 text-sm text-slate-500">
            Separe a operação por frente ou contrato. Cada frota pertence a uma frente, e gestores, supervisores e
            motoristas só veem as frentes em que estão vinculados.
          </p>
        </div>
        <Button className="shrink-0 bg-emerald-700 text-white hover:bg-emerald-800" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova frente
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base font-semibold text-slate-700">Frentes e contratos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!loaded ? (
            <div className="flex flex-col items-center p-8 text-center text-sm text-slate-500">
              <Activity className="mb-2 h-6 w-6 animate-pulse text-slate-300" />
              Carregando frentes...
            </div>
          ) : units.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhuma frente de trabalho cadastrada.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Frente / contrato</TableHead>
                  <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Vínculos</TableHead>
                  <TableHead className="hidden sm:table-cell">Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center">
                        <Briefcase className="mr-2 h-4 w-4 shrink-0 text-slate-500" />
                        <span>{unit.name}</span>
                      </div>
                      {unit.client && <div className="ml-6 text-xs text-slate-500 sm:hidden">{unit.client}</div>}
                    </TableCell>
                    <TableCell className="hidden text-slate-600 sm:table-cell">{unit.client || <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="hidden whitespace-normal text-xs text-slate-500 md:table-cell">
                      {unit._count?.fleets ?? 0} {unit._count?.fleets === 1 ? 'frota' : 'frotas'} ·{' '}
                      {unit._count?.employees ?? 0} {unit._count?.employees === 1 ? 'colaborador' : 'colaboradores'} ·{' '}
                      {unit._count?.users ?? 0} {unit._count?.users === 1 ? 'gestor/supervisor' : 'gestores/supervisores'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant="secondary"
                        className={unit.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}
                      >
                        {unit.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar ${unit.name}`} onClick={() => startEdit(unit)}>
                          <Edit2 className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={unit.isActive ? 'Desativar' : 'Reativar'}
                          aria-label={`${unit.isActive ? 'Desativar' : 'Reativar'} ${unit.name}`}
                          onClick={() => toggleActive(unit)}
                        >
                          <Power className={`h-4 w-4 ${unit.isActive ? 'text-amber-600' : 'text-emerald-600'}`} />
                        </Button>
                        {(unit._count?.fleets ?? 0) === 0 && (
                          <Button variant="ghost" size="icon" title="Excluir" aria-label={`Excluir ${unit.name}`} onClick={() => remove(unit)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50/60 shadow-none">
        <CardContent className="space-y-1 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Como funciona</p>
          <p>• <strong>Frotas:</strong> cada frota pertence a uma frente (escolha em Frotas).</p>
          <p>• <strong>Gestores e supervisores:</strong> escolha as frentes de cada um em Usuários.</p>
          <p>• <strong>Motoristas:</strong> escolha as frentes em Colaboradores. No aplicativo, eles só veem os veículos dessas frentes.</p>
          <p>• <strong>Modelos de checklist:</strong> valem para todas as frentes ou só para as escolhidas.</p>
          <p>• <strong>Administradores</strong> veem todas as frentes.</p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar frente de trabalho' : 'Nova frente de trabalho'}</DialogTitle>
            <DialogDescription>Ex.: um contrato com um cliente, uma obra ou uma base de operação.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Nome da frente / contrato *</Label>
              <Input
                id="unit-name"
                placeholder="Ex.: Contrato Mina Norte"
                value={form.name}
                maxLength={120}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-client">Cliente</Label>
              <Input
                id="unit-client"
                placeholder="Ex.: Mineradora Exemplo S.A."
                value={form.client}
                maxLength={120}
                onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
