'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, AlertOctagon, ClipboardCheck, Activity, Truck, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import type { Checklist, NC } from '@/lib/types';

export default function ReportsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [ncs, setNcs] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReportsData() {
      try {
        setLoading(true);
        const [chkRes, ncRes] = await Promise.allSettled([
          api.get<Checklist[]>('/checklists'),
          api.get<NC[]>('/ncs'),
        ]);

        if (chkRes.status === 'fulfilled') setChecklists(chkRes.value.data);
        if (ncRes.status === 'fulfilled') setNcs(ncRes.value.data);
      } catch (err) {
        console.error('Erro ao buscar dados dos relatórios:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReportsData();
  }, []);

  // Compute stats
  const totalInspections = checklists.length;
  const totalNcs = ncs.length;
  const completedInspections = checklists.filter(c => c.status === 'COMPLETED' || c.status === 'SYNCED').length;
  const complianceRate = totalInspections > 0 
    ? Math.round((completedInspections / totalInspections) * 100) 
    : 100;

  // Inspections by Vehicle
  const vehicleCountMap = checklists.reduce((acc, c) => {
    if (c.vehicle?.plate) {
      acc[c.vehicle.plate] = (acc[c.vehicle.plate] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topVehicles = Object.entries(vehicleCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([plate, count]) => ({
      plate,
      count,
      pct: totalInspections > 0 ? Math.round((count / totalInspections) * 100) : 0,
    }));

  // NCs by Severity
  const severityCount = ncs.reduce((acc, nc) => {
    acc[nc.severity] = (acc[nc.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Métricas de desempenho, uso da frota e conformidade de inspeções da base real.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center">
          <Activity className="h-8 w-8 animate-pulse text-emerald-600 mb-2" />
          Consolidando métricas operacionais...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total de Inspeções</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{totalInspections}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {completedInspections} finalizadas com sucesso
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Não Conformidades</CardTitle>
                <AlertOctagon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{totalNcs}</div>
                <p className="text-xs text-slate-500 mt-1">
                  Falhas apontadas em checklists
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Taxa de Conformidade</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{complianceRate}%</div>
                <p className="text-xs text-slate-500 mt-1">
                  {complianceRate >= 90 ? 'Excelente índice de conformidade' : 'Atenção aos itens reprovados'}
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
                      Nenhuma não conformidade registrada até o momento!
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
