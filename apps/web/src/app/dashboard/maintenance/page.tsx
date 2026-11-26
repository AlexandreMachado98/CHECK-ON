'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Search, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { canManage, seesAllUnits } from '@/lib/roles';
import { matchesSearch } from '@/lib/search';
import { apiErrorMessage, type Fleet } from '@/lib/types';
import { formatKm } from '@/lib/utils';
import { STATE_INFO, STATE_ORDER, dueText, type MaintenanceOverview, type MaintenancePlan, type MaintenanceVehicle, type VehicleMaintenanceState } from '@/lib/maintenance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaintenancePlansDialog } from '@/components/maintenance-plans';
import { MaintenanceStateBadge, MaintenanceVehicleDialog } from '@/components/maintenance-vehicle';
import { MaintenanceRecordDialog, type RecordTarget } from '@/components/maintenance-record';
import { useStoredUser } from '@/lib/use-stored-user';

const ALL = 'ALL';

export default function MaintenancePage() {
  const role = useStoredUser()?.role;
  const manager = canManage(role);
  const admin = seesAllUnits(role);
  const [overview, setOverview] = useState<MaintenanceOverview | null>(null);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stateFilter, setStateFilter] = useState<VehicleMaintenanceState | typeof ALL>(ALL);
  const [fleetFilter, setFleetFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [plansOpen, setPlansOpen] = useState<'list' | 'new' | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);

  // Estado só muda quando as respostas chegam.
  const load = useCallback(
    () =>
      Promise.all([
        api.get<MaintenanceOverview>('/maintenance'),
        api.get<MaintenancePlan[]>('/maintenance/plans'),
        api.get<Fleet[]>('/fleets'),
      ])
        .then(([ov, pl, fl]) => {
          setOverview(ov.data);
          setPlans(pl.data);
          setFleets(fl.data.filter((f) => f.isActive));
          setError('');
        })
        .catch((err) => setError(apiErrorMessage(err, 'Não foi possível carregar a manutenção.')))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => { void load(); }, [load]);

  const vehicles = useMemo(() => {
    return (overview?.vehicles ?? []).filter(
      (v) =>
        (stateFilter === ALL || v.state === stateFilter) &&
        (fleetFilter === ALL || v.fleetId === fleetFilter) &&
        matchesSearch(search, v.plate, v.prefix, v.model, v.fleet?.name),
    );
  }, [overview, stateFilter, fleetFilter, search]);

  const recordFor = (v: MaintenanceVehicle): RecordTarget => ({ id: v.id, plate: v.plate, mileage: v.mileage, plans: v.plans, planId: v.plans[0]?.planId });
  const noPlans = overview !== null && overview.plans === 0;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Manutenção</h1>
          <p className="mt-1 text-sm text-slate-500">Revisões por km de cada veículo, com o km informado nas inspeções do aplicativo.</p>
        </div>
        <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => setPlansOpen('list')}>
          <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" /> Planos de manutenção ({plans.length})
        </Button>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="shrink-0 bg-white" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</Button>
        </div>
      )}

      {noPlans ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Wrench className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Nenhum plano de manutenção ainda</h2>
            <p className="max-w-md text-sm text-slate-600">
              Crie os planos da empresa (ex.: troca de óleo a cada 10.000 km, revisão geral a cada 30.000 km). O portal mostra quais veículos estão perto de vencer com base no km informado nas inspeções.
            </p>
            {manager && <Button onClick={() => setPlansOpen('new')}>Criar o primeiro plano</Button>}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
            {STATE_ORDER.map((state) => {
              const count = overview?.summary[state] ?? 0;
              if (state === 'SEM_PLANO' && count === 0) return null;
              const active = stateFilter === state;
              return (
                <button
                  key={state}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStateFilter(active ? ALL : state)}
                  className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-slate-900 bg-slate-900 text-white' : `${STATE_INFO[state].badge} hover:border-slate-400`}`}
                >
                  <span className={`mr-2 h-2 w-2 rounded-full ${STATE_INFO[state].dot}`} aria-hidden="true" />
                  {STATE_INFO[state].plural}
                  <span className="ml-2 tabular-nums font-bold">{loading ? '—' : count}</span>
                </button>
              );
            })}
          </div>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Veículos ({loading ? '—' : vehicles.length})</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar placa, prefixo ou modelo" aria-label="Buscar veículos" className="h-9 pl-8 sm:w-64" />
                </div>
                {fleets.length > 1 && (
                  <Select value={fleetFilter} onValueChange={(v) => setFleetFilter((v as string) || ALL)}>
                    <SelectTrigger aria-label="Filtrar por frota" className="h-9 sm:w-48"><SelectValue placeholder="Todas as frotas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas as frotas</SelectItem>
                      {fleets.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">Carregando...</p>
              ) : vehicles.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">Nenhum veículo nesta situação.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Km atual</TableHead>
                      <TableHead className="hidden md:table-cell">Próxima manutenção</TableHead>
                      <TableHead className="hidden sm:table-cell">Situação</TableHead>
                      <TableHead className="hidden text-right sm:table-cell"><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => {
                      const next = v.plans[0];
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="whitespace-normal">
                            <span className="flex items-center justify-between gap-2 sm:block">
                              <span className="font-bold tracking-wide text-slate-900">{v.plate}</span>
                              <span className="sm:hidden"><MaintenanceStateBadge state={v.state} /></span>
                            </span>
                            <span className="block text-xs text-slate-500">{[v.prefix && `Prefixo ${v.prefix}`, v.model, v.fleet?.name].filter(Boolean).join(' · ')}</span>
                            <span className="block text-xs tabular-nums text-slate-600 sm:hidden">{v.mileage ? formatKm(v.mileage) : 'Sem km'}</span>
                            {next && <span className="block whitespace-normal text-xs text-slate-600 md:hidden">{next.planName}: {dueText(next)}</span>}
                            {/* No celular, os botões ficam embaixo dos dados (sem colunas cortadas). */}
                            <span className="mt-2 flex gap-2 sm:hidden">
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setVehicleId(v.id)} aria-label={`Ver ficha de manutenção de ${v.plate}`}>Ficha</Button>
                              {manager && v.plans.length > 0 && (
                                <Button size="sm" className="h-8 text-xs" onClick={() => setRecordTarget(recordFor(v))} aria-label={`Registrar manutenção em ${v.plate}`}>
                                  <Wrench className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Registrar
                                </Button>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-slate-800 sm:table-cell">{v.mileage ? formatKm(v.mileage) : '—'}</TableCell>
                          <TableCell className="hidden whitespace-normal md:table-cell">
                            {next ? (
                              <>
                                <span className="text-sm font-medium text-slate-900">{next.planName}</span>
                                <span className="block text-xs text-slate-600">{dueText(next)}{next.estimated && next.state !== 'SEM_KM' ? ' · estimado' : ''}</span>
                                {v.plans.length > 1 && <span className="block text-xs text-slate-500">+ {v.plans.length - 1} {v.plans.length === 2 ? 'outro plano' : 'outros planos'}</span>}
                              </>
                            ) : (
                              <span className="text-sm text-slate-500">Nenhum plano vale para este veículo</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell"><MaintenanceStateBadge state={v.state} /></TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            <div className="flex flex-col items-end gap-1 lg:flex-row lg:justify-end">
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setVehicleId(v.id)} aria-label={`Ver ficha de manutenção de ${v.plate}`}>
                                Ficha
                              </Button>
                              {manager && v.plans.length > 0 && (
                                <Button size="sm" className="h-8 text-xs" onClick={() => setRecordTarget(recordFor(v))} aria-label={`Registrar manutenção em ${v.plate}`}>
                                  <Wrench className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Registrar
                                </Button>
                              )}
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
        </>
      )}

      {plansOpen && (
        <MaintenancePlansDialog
          open
          onClose={() => setPlansOpen(null)}
          plans={plans}
          fleets={fleets}
          manager={manager}
          allowAll={admin}
          onChanged={load}
          startCreating={plansOpen === 'new'}
        />
      )}
      {vehicleId && <MaintenanceVehicleDialog vehicleId={vehicleId} manager={manager} onClose={() => setVehicleId(null)} onChanged={load} />}
      {recordTarget && <MaintenanceRecordDialog target={recordTarget} onClose={() => setRecordTarget(null)} onSaved={load} />}
    </>
  );
}
