'use client';

import { useState } from 'react';
import { Edit2, Lock, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage, type Fleet } from '@/lib/types';
import { formatKm } from '@/lib/utils';
import { intervalText, type MaintenancePlan } from '@/lib/maintenance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { confirmAction, notify } from '@/components/feedback';

type Form = { name: string; intervalKm: string; intervalDays: string; warnBeforeKm: string; fleetId: string };
const EMPTY: Form = { name: '', intervalKm: '', intervalDays: '', warnBeforeKm: '', fleetId: 'ALL' };
const ALL = 'ALL';

const digits = (text: string) => text.replace(/\D/g, '').slice(0, 7);

/**
 * Planos de manutenção: cadastrar, alterar e desativar. Cada plano vale para todos os veículos
 * (só o administrador) ou para os de uma frota. Renderize só quando aberto.
 */
export function MaintenancePlansDialog({
  open,
  onClose,
  plans,
  fleets,
  manager,
  allowAll,
  onChanged,
  startCreating,
}: {
  open: boolean;
  onClose: () => void;
  plans: MaintenancePlan[];
  fleets: Fleet[];
  manager: boolean;
  /** Pode criar plano para todos os veículos (administrador). */
  allowAll: boolean;
  onChanged: () => void;
  /** Abre direto no formulário de plano novo. */
  startCreating?: boolean;
}) {
  // O diálogo é montado a cada abertura (o pai só o renderiza aberto): o estado começa limpo.
  const [editing, setEditing] = useState<MaintenancePlan | 'new' | null>(startCreating ? 'new' : null);
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, fleetId: allowAll ? ALL : fleets[0]?.id ?? '' }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing('new');
    setForm({ ...EMPTY, fleetId: allowAll ? ALL : fleets[0]?.id ?? '' });
    setError('');
  }

  function startEdit(plan: MaintenancePlan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      intervalKm: String(plan.intervalKm),
      intervalDays: plan.intervalDays ? String(plan.intervalDays) : '',
      warnBeforeKm: String(plan.warnBeforeKm),
      fleetId: plan.fleetId ?? ALL,
    });
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const intervalKm = Number(form.intervalKm);
    if (!form.name.trim() || !intervalKm) { setError('Informe o nome e o intervalo em km.'); return; }
    const body = {
      name: form.name.trim(),
      intervalKm,
      intervalDays: form.intervalDays ? Number(form.intervalDays) : null,
      ...(form.warnBeforeKm ? { warnBeforeKm: Number(form.warnBeforeKm) } : {}),
      fleetId: form.fleetId === ALL ? null : form.fleetId,
    };
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await api.post('/maintenance/plans', body);
      else if (editing) await api.patch(`/maintenance/plans/${editing.id}`, body);
      notify(editing === 'new' ? 'Plano de manutenção criado.' : 'Plano de manutenção alterado.', 'success');
      setEditing(null);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar o plano.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(plan: MaintenancePlan) {
    const ok = await confirmAction({
      title: `Desativar "${plan.name}"?`,
      message: 'O plano sai da situação dos veículos. As manutenções já registradas continuam no histórico.',
      confirmLabel: 'Desativar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/maintenance/plans/${plan.id}`);
      notify('Plano desativado.', 'success');
      onChanged();
    } catch (err) {
      notify(apiErrorMessage(err, 'Não foi possível desativar o plano.'));
    }
  }

  const fleetOptions = allowAll ? [{ id: ALL, name: 'Todos os veículos da empresa' }, ...fleets] : fleets;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Planos de manutenção</DialogTitle>
          <DialogDescription>
            Defina a cada quantos km (e, se quiser, a cada quantos dias) cada manutenção precisa ser feita. O km de cada veículo vem das inspeções do aplicativo.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Nome</Label>
              <Input id="plan-name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Troca de óleo e filtros" autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-km">A cada (km)</Label>
                <Input id="plan-km" inputMode="numeric" value={form.intervalKm} onChange={(e) => setForm({ ...form, intervalKm: digits(e.target.value) })} placeholder="10000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-days">Ou a cada (dias)</Label>
                <Input id="plan-days" inputMode="numeric" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: digits(e.target.value).slice(0, 4) })} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-warn">Avisar antes (km)</Label>
                <Input
                  id="plan-warn"
                  inputMode="numeric"
                  value={form.warnBeforeKm}
                  onChange={(e) => setForm({ ...form, warnBeforeKm: digits(e.target.value) })}
                  placeholder={form.intervalKm ? String(Math.min(1000, Math.round(Number(form.intervalKm) / 10))) : '1000'}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-fleet">Vale para</Label>
              <Select value={form.fleetId} onValueChange={(v) => setForm({ ...form, fleetId: (v as string) || ALL })}>
                <SelectTrigger id="plan-fleet" className="w-full"><SelectValue placeholder="Escolha a frota" /></SelectTrigger>
                <SelectContent>
                  {fleetOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Com prazo em dias, vence o que chegar primeiro: o km ou a data.</p>
            </div>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => (startCreating && editing === 'new' && !plans.length ? onClose() : setEditing(null))}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing === 'new' ? 'Criar plano' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-3">
            {plans.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-slate-600">Nenhum plano cadastrado ainda.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {plans.map((plan) => (
                  <li key={plan.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-600">
                        {intervalText(plan)} · aviso {formatKm(plan.warnBeforeKm)} antes
                      </p>
                      <p className="text-xs text-slate-500">{plan.fleet ? `Frota ${plan.fleet.name}${plan.fleet.unit ? ` · ${plan.fleet.unit.name}` : ''}` : 'Todos os veículos da empresa'}</p>
                    </div>
                    {manager && (plan.canEdit !== false ? (
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-slate-600" aria-label={`Alterar ${plan.name}`} onClick={() => startEdit(plan)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-rose-700" aria-label={`Desativar ${plan.name}`} onClick={() => remove(plan)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-flex shrink-0 items-center text-xs text-slate-500" title="Vale para todos os veículos: só o administrador altera">
                        <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Só o administrador
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
              {manager && (
                <Button type="button" onClick={startNew} disabled={!allowAll && fleets.length === 0}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Novo plano
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
