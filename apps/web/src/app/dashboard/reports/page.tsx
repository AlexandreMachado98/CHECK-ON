'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, AlertOctagon, ClipboardCheck, Activity, Truck, ArrowRight, ShieldCheck, FileDown, Sheet } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { getStoredUser } from '@/lib/session';
import { useUnits, unitLabel } from '@/components/unit-picker';
import { notify } from '@/components/feedback';
import {
  type Delta,
  type PeriodKey,
  type Report,
  type VehicleReportRow,
  delta,
  describePeriod,
  describePrevious,
  downloadReportCsv,
  downloadReportPdf,
} from '@/lib/report-export';

/** Períodos aceitos pela API (`/dashboard/report?period=`), mais as datas escolhidas. */
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
  { key: 'all', label: 'Tudo' },
  { key: 'custom', label: 'Datas' },
];
const DEFAULT_PERIOD: PeriodKey = '30d';
const STORAGE_KEY = 'checkon.reports.filter';

type Filter = { period: PeriodKey; from: string; to: string; unitId: string };

/** "AAAA-MM-DD" de hoje no horário da empresa (valor do campo de data). */
function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

/** Filtro padrão: 30 dias, todas as frentes; as datas começam no dia 1º do mês atual. */
function defaultFilter(): Filter {
  const now = today();
  return { period: DEFAULT_PERIOD, from: `${now.slice(0, 8)}01`, to: now, unitId: '' };
}

/** Último filtro usado neste navegador (só conveniência: sem armazenamento, usa o padrão). */
function savedFilter(): Filter {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Filter> | null;
    const base = defaultFilter();
    if (!saved || !PERIODS.some((p) => p.key === saved.period)) return base;
    return { ...base, ...saved };
  } catch {
    return defaultFilter();
  }
}

/** Parâmetros da API para o filtro. */
function filterParams(filter: Filter) {
  return {
    ...(filter.period === 'custom' ? { from: filter.from, to: filter.to } : { period: filter.period }),
    ...(filter.unitId ? { unitId: filter.unitId } : {}),
  };
}

/** Variação em relação ao período anterior, colorida (verde melhorou, vermelho piorou). */
function DeltaLine({ value, previousLabel }: { value: Delta | null; previousLabel: string }) {
  if (!value) return null;
  const color = value.tone === 'good' ? 'text-emerald-700' : value.tone === 'bad' ? 'text-rose-700' : 'text-slate-500';
  const arrow = value.text === '=' ? '' : value.text.startsWith('+') ? '▲ ' : '▼ ';
  return (
    <p className="mt-1 text-xs leading-5 text-slate-500">
      <span className={`font-semibold ${color}`}>{arrow}{value.text}</span> vs {previousLabel}
    </p>
  );
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Filtro aplicado (o que está na tela) e o rascunho das datas, que só vale ao tocar em "Aplicar".
  const [filter, setFilter] = useState<Filter | null>(null);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [exporting, setExporting] = useState<'' | 'pdf' | 'csv'>('');
  const { active: units, choose: chooseUnit } = useUnits();

  async function fetchReport(selected: Filter) {
    try {
      setLoading(true);
      setLoadError('');
      // Calculado no servidor, só do período (e da frente) escolhidos.
      const res = await api.get<Report>('/dashboard/report', { params: filterParams(selected) });
      setReport(res.data);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar os relatórios.'));
    } finally {
      setLoading(false);
    }
  }

  // Abre no último filtro usado neste navegador (lido depois de montar: não existe no servidor).
  useEffect(() => {
    const saved = savedFilter();
    setFilter(saved);
    setDraftFrom(saved.from);
    setDraftTo(saved.to);
  }, []);

  useEffect(() => {
    if (filter) fetchReport(filter);
  }, [filter]);

  function apply(next: Filter) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): só não lembra na próxima vez.
    }
    setFilter(next);
  }

  function choosePeriod(key: PeriodKey) {
    if (!filter) return;
    if (key === 'custom') {
      // Abre os campos de data; o relatório só muda ao aplicar.
      apply({ ...filter, period: 'custom', from: draftFrom || filter.from, to: draftTo || filter.to });
      return;
    }
    apply({ ...filter, period: key });
  }

  const datesInvalid = !draftFrom || !draftTo || draftFrom > draftTo;

  async function exportReport(kind: 'pdf' | 'csv') {
    if (!report || !filter) return;
    setExporting(kind);
    try {
      const res = await api.get<VehicleReportRow[]>('/dashboard/report/vehicles', { params: filterParams(filter) });
      const user = getStoredUser();
      const context = { companyName: user?.tenantName, generatedBy: user?.name };
      if (kind === 'pdf') await downloadReportPdf(report, res.data, context);
      else downloadReportCsv(report, res.data, context);
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível gerar o arquivo do relatório.'));
    } finally {
      setExporting('');
    }
  }

  const period = filter?.period ?? null;
  const shownPeriod = report?.period?.key ?? period ?? DEFAULT_PERIOD;
  const periodText = report ? describePeriod(report.period) : '';
  const previous = report?.previous ?? null;
  const previousLabel = previous ? describePrevious(previous) : '';

  const totalInspections = report?.inspections.total ?? 0;
  const completedInspections = report?.inspections.completed ?? 0;
  const totalNcs = report?.ncs.total ?? 0;
  const complianceRate = report?.complianceRate ?? null;
  const severityCount = report?.ncs.bySeverity ?? {};
  const topVehicles = (report?.topVehicles ?? []).map((v) => ({
    plate: v.plate,
    count: v.count,
    pct: totalInspections > 0 ? Math.round((v.count / totalInspections) * 100) : 0,
  }));

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Conformidade e não conformidades das inspeções
              {report ? ` · ${periodText}${report.unit ? ` · ${report.unit.name}` : ''}` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportReport('pdf')} disabled={!report || loading || !!exporting}>
              <FileDown className="mr-1.5 h-4 w-4" />
              {exporting === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('csv')} disabled={!report || loading || !!exporting}>
              <Sheet className="mr-1.5 h-4 w-4" />
              {exporting === 'csv' ? 'Gerando...' : 'Planilha (Excel)'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div role="group" aria-label="Período do relatório" className="grid w-full grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:flex sm:w-auto">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => choosePeriod(p.key)}
                disabled={loading && period === p.key}
                className={`whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                  period === p.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {chooseUnit && filter && (
            <select
              aria-label="Frente de trabalho"
              value={filter.unitId}
              onChange={(event) => apply({ ...filter, unitId: event.target.value })}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 lg:w-auto lg:min-w-64"
            >
              <option value="">Todas as frentes</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>
              ))}
            </select>
          )}
        </div>

        {period === 'custom' && filter && (
          <form
            className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (!datesInvalid) apply({ ...filter, from: draftFrom, to: draftTo });
            }}
          >
            <label className="text-sm text-slate-600">
              De
              <input type="date" value={draftFrom} max={draftTo || today()} onChange={(e) => setDraftFrom(e.target.value)} className="mt-1 block h-9 rounded-md border border-slate-200 px-2 text-sm text-slate-800" />
            </label>
            <label className="text-sm text-slate-600">
              Até
              <input type="date" value={draftTo} min={draftFrom} max={today()} onChange={(e) => setDraftTo(e.target.value)} className="mt-1 block h-9 rounded-md border border-slate-200 px-2 text-sm text-slate-800" />
            </label>
            <Button type="submit" size="sm" disabled={datesInvalid || (draftFrom === filter.from && draftTo === filter.to && !!report)}>Aplicar</Button>
            {draftFrom > draftTo && draftTo && <p className="text-xs text-rose-700">A data final é anterior à inicial.</p>}
          </form>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center">
          <Activity className="h-8 w-8 animate-pulse text-emerald-600 mb-2" />
          Consolidando métricas operacionais...
        </div>
      ) : loadError ? (
        <div role="alert" className="p-10 text-center text-sm">
          <p className="text-rose-700 mb-3">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => filter && fetchReport(filter)}>Tentar de novo</Button>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
            <Card className="min-h-32 border-slate-200 shadow-sm">
              <CardHeader className="flex min-w-0 flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <CardTitle className="min-w-0 break-words text-sm font-medium leading-5 text-slate-600">Inspeções no período</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{totalInspections}</div>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {completedInspections} finalizada{completedInspections === 1 ? '' : 's'}
                </p>
                <DeltaLine value={delta(totalInspections, previous?.inspections.total, 'count', true)} previousLabel={previousLabel} />
              </CardContent>
            </Card>

            <Card className="min-h-32 border-slate-200 shadow-sm">
              <CardHeader className="flex min-w-0 flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <CardTitle className="min-w-0 break-words text-sm font-medium leading-5 text-slate-600">Não conformidades abertas no período</CardTitle>
                <AlertOctagon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{totalNcs}</div>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {report?.ncs.active ?? 0} ainda ativa{(report?.ncs.active ?? 0) === 1 ? '' : 's'} (abertas ou em tratativa)
                </p>
                <DeltaLine value={delta(totalNcs, previous?.ncs.total, 'count', false)} previousLabel={previousLabel} />
              </CardContent>
            </Card>

            <Card className="min-h-32 border-slate-200 shadow-sm">
              <CardHeader className="flex min-w-0 flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <CardTitle className="min-w-0 break-words text-sm font-medium leading-5 text-slate-600">Taxa de Conformidade</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{complianceRate === null ? '—' : `${complianceRate}%`}</div>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {complianceRate === null
                    ? 'Sem inspeções finalizadas ainda'
                    : `${report?.inspections.compliant ?? 0} de ${completedInspections} inspeções sem nenhum item reprovado`}
                </p>
                <DeltaLine value={delta(complianceRate, previous?.complianceRate, 'points', true)} previousLabel={previousLabel} />
              </CardContent>
            </Card>
          </div>

          {totalInspections === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center flex flex-col items-center">
                <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
                  <ShieldCheck className="h-8 w-8 text-emerald-600" />
                </div>
                {shownPeriod !== 'all' ? (
                  <>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">
                      Nenhuma inspeção {shownPeriod === 'custom' ? 'nas datas escolhidas' : `nos últimos ${PERIODS.find((p) => p.key === shownPeriod)?.label}`}
                      {report?.unit ? ` em ${report.unit.name}` : ''}
                    </h3>
                    <p className="text-sm text-slate-500 max-w-sm mb-5">Escolha um período maior para ver o histórico.</p>
                    <Button variant="outline" onClick={() => choosePeriod('all')}>Ver todo o histórico</Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">Aguardando Execuções</h3>
                    <p className="text-sm text-slate-500 max-w-sm mb-5">
                      Os gráficos analíticos de veículos mais inspecionados e falhas recorrentes serão gerados à medida que os checklists forem concluídos em campo.
                    </p>
                    <Link href="/dashboard/templates">
                      <Button variant="outline">
                        Ver Modelos de Checklist
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-slate-400" />
                    Inspeções por Veículo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {topVehicles.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhum veículo vinculado às inspeções.</p>
                  ) : (
                    <div className="space-y-4">
                      {topVehicles.map((v, i) => (
                        <div key={i} className="flex items-center">
                          <div className="w-24 text-sm font-medium text-slate-800">{v.plate}</div>
                          <div className="flex-1 ml-2">
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.max(v.pct, 5)}%` }}></div>
                            </div>
                          </div>
                          <div className="w-16 text-right text-xs text-slate-500 font-medium ml-4">
                            {v.count} vistoria{v.count > 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-amber-500" />
                    Ocorrências por Gravidade
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {totalNcs === 0 ? (
                    <p className="text-xs text-emerald-600 text-center py-6 font-medium">
                      Nenhuma não conformidade aberta no período!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: 'Crítico', count: severityCount['CRITICAL'] || 0, color: 'bg-rose-500' },
                        { label: 'Alto', count: severityCount['HIGH'] || 0, color: 'bg-orange-500' },
                        { label: 'Médio', count: severityCount['MEDIUM'] || 0, color: 'bg-amber-500' },
                        { label: 'Baixo', count: severityCount['LOW'] || 0, color: 'bg-blue-500' },
                      ].map((s, i) => {
                        const pct = totalNcs > 0 ? Math.round((s.count / totalNcs) * 100) : 0;
                        return (
                          <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-slate-700">{s.label}</span>
                              <span className="text-slate-500">{s.count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}

