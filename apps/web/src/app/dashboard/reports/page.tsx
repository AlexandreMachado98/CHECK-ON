'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, AlertOctagon, ClipboardCheck, ArrowUpRight, Download, Filter } from 'lucide-react';

export default function ReportsPage() {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Métricas de desempenho, uso da frota e conformidade de inspeções.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="shadow-sm">
            <Filter className="h-4 w-4 mr-2 text-slate-500" />
            Filtrar Período
          </Button>
          <Button className="shadow-sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Inspeções</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">1,248</div>
            <p className="text-xs text-emerald-600 flex items-center mt-1 font-medium">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5% este mês
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">NCs Reportadas</CardTitle>
            <AlertOctagon className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">84</div>
            <p className="text-xs text-rose-600 flex items-center mt-1 font-medium">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              +4.2% em relação a média
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Taxa de Conformidade</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">93.2%</div>
            <p className="text-xs text-slate-500 flex items-center mt-1">
              Dentro da meta aceitável (&gt; 90%)
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-slate-900 text-white border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Tempo Médio Resolução</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-slate-400">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14h 30m</div>
            <p className="text-xs text-emerald-400 flex items-center mt-1">
              -2h 15m mais rápido que o esperado
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-700">Inspeções por Veículo (Top 5)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[
                { plate: 'ABC-1234', count: 145, pct: 100 },
                { plate: 'XYZ-9876', count: 132, pct: 91 },
                { plate: 'DEF-5678', count: 110, pct: 75 },
                { plate: 'GHI-9012', count: 89, pct: 61 },
                { plate: 'JKL-3456', count: 72, pct: 49 },
              ].map((v, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-20 text-sm font-medium text-slate-700">{v.plate}</div>
                  <div className="flex-1 ml-4">
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${v.pct}%` }}></div>
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm text-slate-500 font-medium ml-4">{v.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-700">Principais Não Conformidades</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[
                { item: 'Pneu Descalibrado', count: 32, pct: 38, color: 'bg-rose-500' },
                { item: 'Óleo abaixo do nível', count: 24, pct: 28, color: 'bg-amber-500' },
                { item: 'Farol Queimado', count: 15, pct: 17, color: 'bg-blue-500' },
                { item: 'Documentação Atrasada', count: 8, pct: 9, color: 'bg-orange-500' },
                { item: 'Extintor Vencido', count: 5, pct: 6, color: 'bg-purple-500' },
              ].map((v, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{v.item}</span>
                    <span className="text-slate-500 font-medium">{v.count} ocorrências</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${v.color}`} style={{ width: `${v.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
