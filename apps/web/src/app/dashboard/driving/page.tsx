'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, MessageSquare, Phone, Star, X } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { FEEDBACK_STATUS, type DrivingFeedbackItem, type DrivingOverview, type FeedbackStatus } from '@/lib/driving';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notify } from '@/components/feedback';

const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Último ano' },
];

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center" role="img" aria-label={`Nota ${String(value).replace('.', ',')} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const info = FEEDBACK_STATUS[status];
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${info.badge}`}>{info.label}</span>;
}

/** Tratativa do gestor: situação e o que foi feito (obrigatório para "Tratada"). Renderize só aberto. */
function TreatDialog({ item, tags, onClose, onSaved }: { item: DrivingFeedbackItem; tags: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status === 'NOVA' ? 'EM_ANALISE' : item.status);
  const [treatment, setTreatment] = useState(item.treatment ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/driving-feedback/${item.id}`, { status, ...(treatment.trim() ? { treatment: treatment.trim() } : {}) });
      notify(status === 'TRATADA' ? 'Avaliação marcada como tratada.' : 'Avaliação atualizada.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar a tratativa.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tratar avaliação</DialogTitle>
          <DialogDescription>
            {item.driver?.name ?? 'Motorista não identificado'} · {item.vehicle.plate} · {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm">
          <Stars value={item.rating} />
          {item.tags.length > 0 && <p className="text-slate-700">{item.tags.map((t) => tags[t] ?? t).join(' · ')}</p>}
          {item.comment && <p className="whitespace-pre-line text-slate-800">&ldquo;{item.comment}&rdquo;</p>}
          {item.contact && <p className="text-slate-600">Contato do passageiro: {item.contact}</p>}
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="treat-status">Situação</Label>
            <Select value={status} onValueChange={(v) => setStatus((v as FeedbackStatus) || 'EM_ANALISE')}>
              <SelectTrigger id="treat-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FEEDBACK_STATUS) as FeedbackStatus[]).map((s) => <SelectItem key={s} value={s}>{FEEDBACK_STATUS[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="treat-text">O que foi feito {status === 'TRATADA' ? '' : '(opcional)'}</Label>
            <textarea
              id="treat-text"
              value={treatment}
              maxLength={2000}
              rows={4}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="Ex.: conversa com o motorista, reciclagem de direção defensiva, retorno ao passageiro..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DrivingPage() {
  const [days, setDays] = useState('30');
  const [status, setStatus] = useState('OPEN');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null);
  const [data, setData] = useState<DrivingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [treating, setTreating] = useState<DrivingFeedbackItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DrivingOverview>('/driving-feedback', {
        params: { days, ...(status !== 'ALL' ? { status } : {}), ...(alertsOnly ? { alerts: 'true' } : {}), ...(driver ? { driverId: driver.id } : {}) },
      });
      setData(res.data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível carregar as avaliações.'));
    } finally {
      setLoading(false);
    }
  }, [days, status, alertsOnly, driver]);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.summary;
  const tags = data?.tags ?? {};

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Como estou dirigindo</h1>
          <p className="mt-1 text-sm text-slate-500">Avaliações dos passageiros pelo QR Code de dentro do veículo. O motorista é identificado pela inspeção do dia.</p>
        </div>
        <Select value={days} onValueChange={(v) => setDays((v as string) || '30')}>
          <SelectTrigger aria-label="Período" className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="shrink-0 bg-white" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</Button>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-600">Avaliações no período</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{loading || !summary ? '—' : summary.count}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-600">Nota média</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-slate-900">{loading || !summary || !summary.count ? '—' : summary.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
              {summary && summary.count > 0 && <Stars value={summary.average} />}
            </div>
          </CardContent>
        </Card>
        <button type="button" onClick={() => { setAlertsOnly(true); setStatus('OPEN'); }} className="text-left">
          <Card className={`h-full shadow-sm transition-colors hover:border-rose-300 ${summary?.openAlerts ? 'border-rose-200 bg-rose-50' : ''}`}>
            <CardContent className="p-4">
              <p className="flex items-center text-sm font-medium text-slate-600"><AlertTriangle className="mr-1.5 h-4 w-4 text-rose-600" aria-hidden="true" /> Alertas para tratar</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${summary?.openAlerts ? 'text-rose-700' : 'text-slate-900'}`}>{loading || !summary ? '—' : summary.openAlerts}</p>
              <p className="text-xs text-slate-700">Nota 1 ou 2, ou celular ao volante (todos os períodos)</p>
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="shadow-sm xl:col-span-2">
          <CardHeader className="border-b"><CardTitle className="text-base font-semibold text-slate-800">Motoristas</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!data?.drivers.length ? (
              <p className="p-6 text-center text-sm text-slate-500">{loading ? 'Carregando...' : 'Nenhuma avaliação no período.'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorista</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                    <TableHead className="text-right">Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.drivers.map((d) => (
                    <TableRow key={d.driverId ?? 'none'}>
                      <TableCell className="whitespace-normal">
                        <button type="button" className="text-left font-medium text-slate-900 underline-offset-2 hover:underline" onClick={() => setDriver({ id: d.driverId ?? 'none', name: d.name })}>
                          {d.name}
                        </button>
                        <span className="block text-xs text-slate-500">{[d.matricula && `Matrícula ${d.matricula}`, `${d.count} ${d.count === 1 ? 'avaliação' : 'avaliações'}`].filter(Boolean).join(' · ')}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold tabular-nums">{d.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
                        <span className="block"><Stars value={d.average} size="h-3 w-3" /></span>
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${d.openAlerts ? 'text-rose-700' : 'text-slate-400'}`}>{d.openAlerts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm xl:col-span-3">
          <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">Avaliações</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {driver && (
                <span className="inline-flex items-center rounded-md border bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
                  {driver.name}
                  <button type="button" onClick={() => setDriver(null)} className="ml-1 rounded p-0.5 hover:bg-slate-200" aria-label={`Tirar o filtro de ${driver.name}`}><X className="h-3 w-3" /></button>
                </span>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-rose-700" checked={alertsOnly} onChange={(e) => setAlertsOnly(e.target.checked)} /> Só alertas
              </label>
              <Select value={status} onValueChange={(v) => setStatus((v as string) || 'OPEN')}>
                <SelectTrigger aria-label="Situação" className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Abertas</SelectItem>
                  <SelectItem value="TRATADA">Tratadas</SelectItem>
                  <SelectItem value="ALL">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!data?.items.length ? (
              <p className="p-6 text-center text-sm text-slate-500">{loading ? 'Carregando...' : 'Nenhuma avaliação com estes filtros.'}</p>
            ) : (
              <ul className="divide-y">
                {data.items.map((item) => (
                  <li key={item.id} className={`flex flex-col gap-2 p-4 sm:flex-row ${item.alert && item.status !== 'TRATADA' ? 'bg-rose-50/50' : ''}`}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars value={item.rating} />
                        <StatusBadge status={item.status} />
                        {item.alert && <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800"><AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" /> Alerta</span>}
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {item.driver?.name ?? 'Motorista não identificado'} <span className="font-normal text-slate-500">· {item.vehicle.prefix ? `${item.vehicle.prefix} · ` : ''}{item.vehicle.plate}</span>
                      </p>
                      <p className="text-xs text-slate-500">{format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{tags[t] ?? t}</span>)}
                        </div>
                      )}
                      {item.comment && <p className="flex items-start gap-1.5 whitespace-pre-line text-sm text-slate-800"><MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />{item.comment}</p>}
                      {item.contact && <p className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{item.contact}</p>}
                      {item.treatment && (
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
                          <strong>Tratativa:</strong> {item.treatment}
                          {item.treatedByName && <span className="text-emerald-800"> · {item.treatedByName}{item.treatedAt ? ` em ${format(new Date(item.treatedAt), 'dd/MM/yyyy')}` : ''}</span>}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {/* Alerta aberto pede tratativa; avaliação boa ou já tratada só se consulta (ou anota). */}
                      {item.alert && item.status !== 'TRATADA' ? (
                        <Button size="sm" onClick={() => setTreating(item)} aria-label={`Tratar avaliação de ${item.driver?.name ?? 'motorista não identificado'} em ${format(new Date(item.createdAt), 'dd/MM HH:mm')}`}>Tratar</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setTreating(item)} aria-label={`Detalhes da avaliação de ${item.driver?.name ?? 'motorista não identificado'} em ${format(new Date(item.createdAt), 'dd/MM HH:mm')}`}>Detalhes</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {treating && <TreatDialog item={treating} tags={tags} onClose={() => setTreating(null)} onSaved={load} />}
    </>
  );
}
