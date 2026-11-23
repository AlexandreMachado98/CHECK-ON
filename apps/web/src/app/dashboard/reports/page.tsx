'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, AlertOctagon, ClipboardCheck, Activity, Truck, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';

/** Períodos aceitos pela API (`/dashboard/report?period=`). */
const PERIODS = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
  { key: 'all', label: 'Tudo' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];
const DEFAULT_PERIOD: PeriodKey = '30d';
const PERIOD_STORAGE_KEY = 'checkon.reports.period';

/** Último período escolhido neste navegador (só conveniência: sem acesso ao armazenamento, usa 30 dias). */
function savedPeriod(): PeriodKey {
  try {
    const value = window.localStorage.getItem(PERIOD_STORAGE_KEY);
    return PERIODS.some((p) => p.key === value) ? (value as PeriodKey) : DEFAULT_PERIOD;
  } catch {
    return DEFAULT_PERIOD;
  }
}

/** "últimos 30 dias (desde 25/10/2026)" / "todo o histórico". */
function periodDescription(key: PeriodKey, from: string | null): string {
  if (key === 'all' || !from) return 'todo o histórico';
  const label = PERIODS.find((p) => p.key === key)?.label ?? key;
  const since = new Date(from).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `últimos ${label} (desde ${since})`;
}

type Report = {
  period?: { key: PeriodKey; from: string | null };
  inspections: { total: number; completed: number; withNc: number; compliant: number };
  complianceRate: number | null;
  ncs: { total: number; active: number; bySeverity: Record<string, number> };
  topVehicles: { vehicleId: string; plate: string; count: number }[];
};

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState<PeriodKey | null>(null);

  async function fetchReport(selected: PeriodKey) {
    try {
      setLoading(true);
      setLoadError('');
      // Calculado no servidor, só do período escolhido: não pesa mais com os anos de histórico.
      const res = await api.get<Report>('/dashboard/report', { params: { period: selected } });
      setReport(res.data);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar os relatórios.'));
    } finally {
      setLoading(false);
    }
  }

  // Abre no último período escolhido neste navegador (lido depois de montar: não existe no servidor).
  useEffect(() => {
    setPeriod(savedPeriod());
  }, []);

  useEffect(() => {
    if (period) fetchReport(period);
  }, [period]);

  function choosePeriod(key: PeriodKey) {
    try {
      window.localStorage.setItem(PERIOD_STORAGE_KEY, key);
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): só não lembra na próxima vez.
    }
    setPeriod(key);
  }

  const shownPeriod = report?.period?.key ?? period ?? DEFAULT_PERIOD;
  const periodText = periodDescription(shownPeriod, report?.period?.from ?? null);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Métricas de desempenho, uso da frota e conformidade de inspeções{report ? ` · ${periodText}` : ''}.
          </p>
        </div>
        <div role="group" aria-label="Período do relatório" className="flex w-full shrink-0 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => choosePeriod(p.key)}
              disabled={loading && period === p.key}
              className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-3 ${
                period === p.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center">
          <Activity className="h-8 w-8 animate-pulse text-emerald-600 mb-2" />
          Consolidando métricas operacionais...
        </div>
      ) : loadError ? (
        <div role="alert" className="p-10 text-center text-sm">
          <p className="text-rose-700 mb-3">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => fetchReport(period ?? DEFAULT_PERIOD)}>Tentar de novo</Button>
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
                    <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma inspeção nos {PERIODS.find((p) => p.key === shownPeriod)?.label}</h3>
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

