'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { confirmAction, notify } from '@/components/feedback';
import api from '@/lib/api';
import { canManage } from '@/lib/roles';
import { matchesSearch } from '@/lib/search';
import { getStoredUser } from '@/lib/session';
import { apiErrorMessage, type Vehicle } from '@/lib/types';
import { formatKm } from '@/lib/utils';

const endpoint = '/maintenance/plans';
const odometerMax = 9_999_999;
const selectClass = 'h-9 rounded-lg border border-input bg-background px-2 text-sm';

const statuses = {
  OVERDUE: { label: 'Vencido', color: 'bg-rose-100 text-rose-800' },
  DUE: { label: 'No vencimento', color: 'bg-rose-100 text-rose-800' },
  UPCOMING: { label: 'Próximo do vencimento', color: 'bg-amber-100 text-amber-800' },
  ON_TRACK: { label: 'Em dia', color: 'bg-emerald-100 text-emerald-800' },
  ARCHIVED: { label: 'Arquivado', color: 'bg-slate-100 text-slate-700' },
  INACTIVE: { label: 'Veículo inativo', color: 'bg-slate-100 text-slate-700' },
};

type Named = { id: string; name: string };

function distinctOptions(items: Named[]) {
  return Array.from(new Map(items.map(item => [item.id, item])).values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

type Status = keyof typeof statuses;
type Plan = {
  id: string;
  name: string;
  baseDate: string | null;
  intervalDays: number | null;
  dueDate: string | null;
  baseKm: number;
  initialKm: number | null;
  _count: { services: number };
  intervalKm: number;
  warningKm: number;
  dueKm: number;
  remainingKm: number;
  status: Exclude<Status, 'ARCHIVED' | 'INACTIVE'>;
  archivedAt: string | null;
  vehicle: Pick<Vehicle, 'id' | 'plate' | 'prefix' | 'isActive'> & { mileage: number; fleet: Named & { unit: Named } };
};
type Service = { serviceDate: string | null; workshop: string | null; costCents: number | null; id: string; mileageKm: number; notes: string | null; recordedAt: string };
type Editor = { kind: 'create' } | { kind: 'edit' | 'record' | 'history'; plan: Plan };

function formatDay(value: string) {
  return value.slice(0, 10).split('-').reverse().join('/');
}

function statusOf(plan: Plan): Status {
  if (plan.archivedAt) return 'ARCHIVED';
  if (!plan.vehicle.isActive) return 'INACTIVE';
  return plan.status;
}

export default function MaintenancePage() {
  const manager = canManage(getStoredUser()?.role);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [fleetFilter, setFleetFilter] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Status | ''>('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);

  function loadPlans(signal?: AbortSignal) {
    return api.get<Plan[]>(endpoint, { signal })
      .then((response) => setPlans(response.data))
      .catch((error) => {
        if (!signal?.aborted) setLoadError(apiErrorMessage(error, 'Não foi possível carregar os planos.'));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadPlans(controller.signal);
    return () => controller.abort();
  }, []);

  async function refreshPlans() {
    setLoading(true);
    setLoadError('');
    await loadPlans();
  }

  async function openSchedule(plan?: Plan) {
    setBusy(true);
    try {
      const response = await api.get<Vehicle[]>('/vehicles');
      setVehicles(response.data.filter((vehicle) => vehicle.isActive || vehicle.id === plan?.vehicle.id));
      setEditor(plan ? { kind: 'edit', plan } : { kind: 'create' });
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível carregar os veículos.'));
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(plan: Plan, permanent = false) {
    if (!(await confirmAction({
      title: permanent ? 'Excluir plano definitivamente' : 'Arquivar plano',
      danger: permanent,
      message: permanent ? `Excluir “${plan.name}” do veículo ${plan.vehicle.plate} e todo o histórico de serviços deste plano? Esta ação é definitiva.` : `Arquivar “${plan.name}” do veículo ${plan.vehicle.plate}? O histórico continuará disponível.`,
      confirmLabel: permanent ? 'Excluir definitivamente' : 'Arquivar',
    }))) return;

    setBusy(true);
    try {
      await api.delete(`${endpoint}/${plan.id}${permanent ? '/permanent' : ''}`);
      notify(permanent ? 'Plano excluído.' : 'Plano arquivado.');
      await refreshPlans();
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível concluir a operação.'));
    } finally {
      setBusy(false);
    }
  }

  const units = distinctOptions(plans.map(p => p.vehicle.fleet.unit));
  const fleets = distinctOptions(plans.filter(p => !unitFilter || p.vehicle.fleet.unit.id === unitFilter).map(p => p.vehicle.fleet));
  const visiblePlans = plans.filter((plan) => {
    const status = statusOf(plan);
    return (filter ? status === filter : status !== 'ARCHIVED' && status !== 'INACTIVE')
      && (!unitFilter || plan.vehicle.fleet.unit.id === unitFilter)
      && (!fleetFilter || plan.vehicle.fleet.id === fleetFilter)
      && matchesSearch(search, plan.name, plan.vehicle.plate, plan.vehicle.prefix);
  }).sort((a, b) => a.remainingKm - b.remainingKm);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manutenção</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe as próximas revisões pelo km registrado nos veículos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={loading || busy} onClick={refreshPlans}>Atualizar</Button>
          {manager && <Button disabled={busy} onClick={() => openSchedule()}>Novo plano</Button>}
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" aria-label="Buscar planos" placeholder="Buscar por serviço, placa ou prefixo" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className={selectClass} aria-label="Filtrar por frente" value={unitFilter} onChange={e => { setUnitFilter(e.target.value); setFleetFilter(''); }}>
          <option value="">Todas as frentes</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className={selectClass} aria-label="Filtrar por frota" value={fleetFilter} onChange={e => setFleetFilter(e.target.value)}>
          <option value="">Todas as frotas</option>
          {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className={selectClass} aria-label="Filtrar por situação" value={filter} onChange={(event) => setFilter(event.target.value as Status | '')}>
          <option value="">Planos ativos</option>
          {Object.entries(statuses).map(([key, status]) => <option key={key} value={key}>{status.label}</option>)}
        </select>
      </div>

      {loading && <p role="status">Carregando planos…</p>}
      {!loading && loadError && <p role="alert" className="text-destructive">{loadError}</p>}
      {!loading && !loadError && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead><TableHead>Veículo</TableHead><TableHead>Km atual</TableHead>
                  <TableHead>Próxima manutenção</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePlans.map((plan) => {
                  const status = statuses[statusOf(plan)];
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">A cada {formatKm(plan.intervalKm)}</div>
                      </TableCell>
                      <TableCell>{plan.vehicle.plate}{plan.vehicle.prefix && ` · ${plan.vehicle.prefix}`}</TableCell>
                      <TableCell>{formatKm(plan.vehicle.mileage)}</TableCell>
                      <TableCell>
                        {formatKm(plan.dueKm)}
                        {plan.dueDate && <div>ou {formatDay(plan.dueDate)}</div>}
                        {!plan.archivedAt && plan.vehicle.isActive && plan.remainingKm !== 0 && (
                          <div className="text-xs text-muted-foreground">
                            {plan.remainingKm > 0 ? 'Faltam' : 'Ultrapassou em'} {formatKm(Math.abs(plan.remainingKm))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>{status.label}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditor({ kind: 'history', plan })}>Histórico</Button>
                          {manager && !plan.archivedAt && (
                            <>
                              {plan.vehicle.isActive && <Button size="sm" variant="outline" onClick={() => setEditor({ kind: 'record', plan })}>Registrar serviço</Button>}
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => openSchedule(plan)}>Editar</Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => removePlan(plan)}>Arquivar</Button>
                            </>
                          )}
                          {manager && <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => removePlan(plan, true)}>Excluir</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visiblePlans.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum plano encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editor && <PlanDialog editor={editor} vehicles={vehicles} close={() => setEditor(null)} saved={refreshPlans} />}
    </div>
  );
}

function PlanDialog({ editor, vehicles, close, saved }: {
  editor: Editor;
  vehicles: Vehicle[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const plan = editor.kind === 'create' ? null : editor.plan;
  const history = editor.kind === 'history';
  const recording = editor.kind === 'record';
  const creating = editor.kind === 'create';
  const [fleetMode, setFleetMode] = useState(false);
  const fleetOptions = distinctOptions(vehicles.flatMap(v => v.fleet ? [v.fleet] : []));
  const [fleetId, setFleetId] = useState(fleetOptions[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState(plan?.vehicle.id ?? vehicles[0]?.id ?? '');
  const [baseKm, setBaseKm] = useState(plan ? String(plan.initialKm ?? '') : String(vehicles[0]?.mileage ?? 0));
  const [intervalDays, setIntervalDays] = useState(String(plan?.intervalDays ?? ''));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [services, setServices] = useState<Service[] | null>(null);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

  useEffect(() => {
    if (!history || !plan) return;
    const controller = new AbortController();
    api.get<Service[]>(`${endpoint}/${plan.id}/services`, { signal: controller.signal })
      .then((response) => setServices(response.data))
      .catch((error) => {
        if (!controller.signal.aborted) setErrorMessage(apiErrorMessage(error, 'Não foi possível carregar o histórico.'));
      });
    return () => controller.abort();
  }, [history, plan]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setErrorMessage('');
    let message = recording ? 'Serviço registrado.' : 'Plano salvo.';
    try {
      if (recording && plan) {
        await api.post(`${endpoint}/${plan.id}/services`, {
          mileageKm: Number(data.get('mileageKm')),
          notes: String(data.get('notes')),
          serviceDate: data.get('serviceDate'),
          workshop: data.get('workshop'),
          costCents: data.get('cost') ? Math.round(Number(data.get('cost')) * 100) : undefined,
        });
      } else {
        const schedule = {
          name: String(data.get('name')),
          intervalDays: intervalDays ? Number(intervalDays) : null,
          baseDate: data.get('baseDate') || undefined,
          intervalKm: Number(data.get('intervalKm')),
          warningKm: Number(data.get('warningKm')),
        };
        if (creating && fleetMode) {
          const { data: result } = await api.post<{ created: number; existing: number }>(`${endpoint}/fleet/${fleetId}`, schedule);
          message = `Planos criados: ${result.created}. Veículos que já tinham esse serviço: ${result.existing}.`;
        } else if (creating) await api.post(endpoint, { ...schedule, vehicleId, baseKm: Number(baseKm) });
        else if (plan) await api.patch(`${endpoint}/${plan.id}`, { ...schedule, vehicleId, baseKm: baseKm ? Number(baseKm) : undefined });
      }
      notify(message);
      close();
      await saved();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, 'Não foi possível salvar.'));
    } finally {
      setSubmitting(false);
    }
  }

  const title = { create: 'Novo plano', edit: 'Editar plano', record: 'Registrar serviço', history: 'Histórico de manutenção' }[editor.kind];

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) close(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {plan
              ? `${plan.vehicle.plate} · ${plan.name} · Km atual: ${formatKm(plan.vehicle.mileage)}`
              : 'Defina o intervalo entre serviços de um veículo.'}
          </DialogDescription>
        </DialogHeader>
        {errorMessage && <p role="alert" className="text-destructive">{errorMessage}</p>}
        {history ? (
          <div className="space-y-2">
            {!services && !errorMessage && <p role="status">Carregando histórico…</p>}
            {services?.length === 0 && <p>Nenhum serviço registrado.</p>}
            {services?.map((service) => (
              <div key={service.id} className="rounded-lg border p-3">
                <p className="font-medium">{formatKm(service.mileageKm)}</p>
                <p className="text-muted-foreground">Registrado em {new Date(service.recordedAt).toLocaleString('pt-BR')}</p>
                {service.serviceDate && <p>Data do serviço: {formatDay(service.serviceDate)}</p>}
                {service.workshop && <p>Oficina: {service.workshop}</p>}
                {service.costCents != null && <p>Custo: {(service.costCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                {service.notes && <p className="mt-1 whitespace-pre-wrap break-words">{service.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            {creating && <label className="flex items-center gap-2">
              <input type="checkbox" checked={fleetMode} onChange={e => setFleetMode(e.target.checked)} />
              Aplicar aos veículos de uma frota
            </label>}
            {fleetMode && <label className="grid gap-1">Frota
              <select required value={fleetId} className={selectClass} onChange={e => setFleetId(e.target.value)}>
                {fleetOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <span className="text-muted-foreground">Cada veículo ativo começa pelo seu km atual. Veículos que já têm um plano ativo com esse nome mantêm seu ciclo. Para incluir veículos novos, aplique novamente.</span>
            </label>}
            {!fleetMode && (creating || editor.kind === 'edit') && (
              <>
                <label className="grid gap-1">Veículo
                  <select className={selectClass} required value={vehicleId} onChange={(event) => {
                    setVehicleId(event.target.value);
                    setBaseKm(String(vehicles.find((vehicle) => vehicle.id === event.target.value)?.mileage ?? 0));
                  }}>
                    {vehicles.length === 0 && <option value="">Nenhum veículo ativo disponível</option>}
                    {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}{vehicle.prefix ? ` · ${vehicle.prefix}` : ''}</option>)}
                  </select>
                </label>
                {!!plan?._count.services && <p className="text-muted-foreground">{vehicleId !== plan.vehicle.id
                  ? 'Ao trocar o veículo, o plano atual será arquivado com seu histórico e um novo plano começará no veículo escolhido.'
                  : 'O último serviço continua sendo a referência da próxima revisão. Em planos antigos, o km inicial pode estar em branco.'}</p>}
                <label className="grid gap-1">Km inicial
                  <Input type="number" required={creating || plan?.initialKm != null || vehicleId !== plan?.vehicle.id} min={0} max={odometerMax} value={baseKm} onChange={(event) => setBaseKm(event.target.value)} />
                  <span className="text-muted-foreground">Km cadastrado: {formatKm(selectedVehicle?.mileage ?? 0)}. Informe o km da última revisão ou o km atual do painel. Um valor maior atualiza também o cadastro do veículo.</span>
                </label>
              </>
            )}
            {recording && plan ? (
              <>
                <label className="grid gap-1">Km do serviço
                  <Input name="mileageKm" type="number" required min={plan.baseKm} max={Math.min(odometerMax, plan.vehicle.mileage)} defaultValue={plan.vehicle.mileage} />
                  <span className="text-muted-foreground">O próximo vencimento será calculado a partir deste km.</span>
                </label>
                <label className="grid gap-1">Data do serviço
                  <Input type="date" name="serviceDate" required max={today} defaultValue={today} />
                </label>
                <label className="grid gap-1">Oficina (opcional)
                  <Input name="workshop" maxLength={160} />
                </label>
                <label className="grid gap-1">Custo em reais (opcional)
                  <Input name="cost" type="number" min="0" max="21474836.47" step="0.01" />
                </label>
                <label className="grid gap-1">Observação (opcional)
                  <textarea className="min-h-20 rounded-lg border border-input bg-background p-2" name="notes" maxLength={1000} />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-1">Nome do serviço
                  <Input name="name" required maxLength={120} placeholder="Ex.: Troca de óleo" defaultValue={plan?.name} />
                </label>
                <label className="grid gap-1">Intervalo entre serviços (km)
                  <Input name="intervalKm" type="number" required min={1} max={odometerMax} defaultValue={plan?.intervalKm} />
                </label>
                <label className="grid gap-1">Intervalo em dias (opcional)
                  <Input type="number" min={1} max={36500} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                </label>
                {intervalDays && <label className="grid gap-1">Início do ciclo
                  <Input key={vehicleId} name="baseDate" type="date" required max={today}
                    disabled={!!plan?._count.services && vehicleId === plan.vehicle.id}
                    defaultValue={vehicleId === plan?.vehicle.id ? plan.baseDate?.slice(0, 10) ?? today : today} />
                  <span className="text-muted-foreground">A revisão vence quando atingir o km ou a data, o que ocorrer primeiro.</span>
                </label>}
                <label className="grid gap-1">Antecedência do aviso (km)
                  <Input name="warningKm" type="number" required min={0} max={odometerMax} defaultValue={plan?.warningKm ?? 0} />
                </label>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={submitting} onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={submitting || (creating && !(fleetMode ? fleetId : vehicleId))}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
