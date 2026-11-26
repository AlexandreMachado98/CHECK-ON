'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Gauge, Loader2, Plus, Trash2, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { formatKm } from '@/lib/utils';
import { STATE_INFO, dueText, formatMoney, intervalText, type MaintenanceVehicleDetail, type VehicleMaintenanceState } from '@/lib/maintenance';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { confirmAction, notify } from '@/components/feedback';
import { MaintenanceRecordDialog, type RecordTarget } from '@/components/maintenance-record';

const day = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'dd/MM/yyyy') : '—');

export function MaintenanceStateBadge({ state }: { state: VehicleMaintenanceState }) {
  const info = STATE_INFO[state];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${info.badge}`}>
      <span className={`mr-1.5 h-2 w-2 rounded-full ${info.dot}`} aria-hidden="true" />
      {info.label}
    </span>
  );
}

/**
 * Ficha de manutenção do veículo: situação de cada plano, manutenções feitas (com custo) e o km
 * informado nas inspeções. Renderize só quando houver veículo escolhido.
 */
export function MaintenanceVehicleDialog({ vehicleId, manager, onClose, onChanged }: { vehicleId: string; manager: boolean; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<MaintenanceVehicleDetail | null>(null);
  const [error, setError] = useState('');
  const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
  const [allReadings, setAllReadings] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<MaintenanceVehicleDetail>(`/maintenance/vehicles/${vehicleId}`);
      setDetail(res.data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível carregar a ficha do veículo.'));
    }
  }, [vehicleId]);

  useEffect(() => { void load(); }, [load]);

  function changed() {
    void load();
    onChanged();
  }

  async function removeRecord(id: string, title: string) {
    const ok = await confirmAction({ title: 'Excluir este registro?', message: `"${title}" sai do histórico, e o vencimento do plano volta a contar pela manutenção anterior.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/maintenance/records/${id}`);
      notify('Registro excluído.', 'success');
      changed();
    } catch (err) {
      notify(apiErrorMessage(err, 'Não foi possível excluir o registro.'));
    }
  }

  const v = detail?.vehicle;
  const total = detail?.records.reduce((sum, r) => sum + (r.cost ?? 0), 0) ?? 0;
  const readings = detail ? (allReadings ? detail.readings : detail.readings.slice(0, 8)) : [];
  const target = (planId?: string): RecordTarget | null => (detail && v ? { id: v.id, plate: v.plate, mileage: v.mileage, plans: detail.plans, planId } : null);

  return (
    <>
      <Dialog open={!recordTarget} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{v ? `Manutenção · ${v.plate}` : 'Manutenção do veículo'}</DialogTitle>
            <DialogDescription>
              {v ? [v.prefix && `Prefixo ${v.prefix}`, [v.brand, v.model].filter(Boolean).join(' '), v.fleet && `Frota ${v.fleet.name}`].filter(Boolean).join(' · ') : 'Carregando...'}
            </DialogDescription>
          </DialogHeader>

          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {!detail && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Carregando" /></div>}

          {detail && v && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Gauge className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-slate-500">Km atual</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900">{v.mileage ? formatKm(v.mileage) : 'Sem km registrado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MaintenanceStateBadge state={detail.state} />
                  {manager && (
                    <Button size="sm" onClick={() => setRecordTarget(target())}>
                      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Registrar manutenção
                    </Button>
                  )}
                </div>
              </div>

              <section aria-labelledby="mv-plans">
                <h3 id="mv-plans" className="mb-2 text-sm font-semibold text-slate-900">Planos deste veículo</h3>
                {detail.plans.length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhum plano de manutenção vale para este veículo. Cadastre em &ldquo;Planos de manutenção&rdquo;.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {detail.plans.map((p) => (
                      <li key={p.planId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{p.planName}</span>
                            <MaintenanceStateBadge state={p.state} />
                          </div>
                          <p className="text-xs text-slate-700">{dueText(p)}</p>
                          <p className="text-xs text-slate-500">
                            {intervalText(p)} · {p.lastDate ? `última em ${day(p.lastDate)} aos ${formatKm(p.lastKm ?? 0)}` : 'nenhuma registrada (vencimento estimado)'}
                          </p>
                        </div>
                        {manager && (
                          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setRecordTarget(target(p.planId))}>
                            <Wrench className="mr-1.5 h-4 w-4" aria-hidden="true" /> Registrar feita
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="mv-records">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 id="mv-records" className="text-sm font-semibold text-slate-900">Manutenções feitas</h3>
                  {total > 0 && <p className="text-xs text-slate-600">Total gasto: <strong>{formatMoney(total)}</strong></p>}
                </div>
                {detail.records.length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhuma manutenção registrada.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Data</th>
                          <th className="px-3 py-2 font-semibold">Serviço</th>
                          <th className="px-3 py-2 text-right font-semibold">Km</th>
                          <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Custo</th>
                          {manager && <th className="px-3 py-2"><span className="sr-only">Ações</span></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detail.records.map((r) => (
                          <tr key={r.id} className="align-top">
                            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{day(r.performedAt)}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-900">{r.title}</span>
                              {!r.planId && <span className="ml-1.5 text-xs text-slate-500">(avulsa)</span>}
                              <span className="block text-xs text-slate-500">
                                {[r.workshop, r.cost != null && `${formatMoney(r.cost)}`, r.createdByName && `registrado por ${r.createdByName}`].filter(Boolean).join(' · ')}
                              </span>
                              {r.notes && <span className="block whitespace-pre-line text-xs text-slate-600">{r.notes}</span>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatKm(r.km)}</td>
                            <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums sm:table-cell">{formatMoney(r.cost) || '—'}</td>
                            {manager && (
                              <td className="px-1 py-1 text-right">
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-700" aria-label={`Excluir registro ${r.title} de ${day(r.performedAt)}`} onClick={() => removeRecord(r.id, r.title)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section aria-labelledby="mv-readings">
                <h3 id="mv-readings" className="mb-2 text-sm font-semibold text-slate-900">Km informado nas inspeções</h3>
                {detail.readings.length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhuma inspeção com km ainda. O km entra quando o motorista faz o checklist no app (opção &ldquo;Pedir o km do veículo&rdquo; no modelo).</p>
                ) : (
                  <>
                    <ul className="divide-y rounded-md border text-sm">
                      {readings.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-slate-700">{r.completedAt ? format(new Date(r.completedAt), "dd/MM/yyyy 'às' HH:mm") : '—'}{r.driver?.name && <span className="text-slate-500"> · {r.driver.name}</span>}</span>
                          <span className="font-semibold tabular-nums text-slate-900">{formatKm(r.odometerKm)}</span>
                        </li>
                      ))}
                    </ul>
                    {detail.readings.length > 8 && (
                      <Button variant="ghost" size="sm" className="mt-1" onClick={() => setAllReadings(!allReadings)}>
                        {allReadings ? 'Mostrar menos' : `Ver as ${detail.readings.length} leituras`}
                      </Button>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {recordTarget && <MaintenanceRecordDialog target={recordTarget} onClose={() => setRecordTarget(null)} onSaved={changed} />}
    </>
  );
}
