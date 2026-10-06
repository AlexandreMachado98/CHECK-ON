'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, Users, ShieldCheck, FolderOpen, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import type { NC } from '@/lib/types';

interface DashboardSummary {
  activeVehicles: number;
  activeFleets: number;
  activeEmployees: number;
  activeUsers: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [ncs, setNcs] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [sumRes, ncsRes] = await Promise.allSettled([
          api.get<DashboardSummary>('/dashboard/summary'),
          api.get<NC[]>('/ncs')
        ]);
        
        if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
        if (ncsRes.status === 'fulfilled') setNcs(ncsRes.value.data);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const openNcs = ncs.filter(nc => nc.status === 'OPEN' || nc.status === 'IN_PROGRESS');

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Visão Geral da Operação</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe a situação atual da frota, equipes e conformidade de inspeções.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 py-1.5 px-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            Operação em Tempo Real
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Veículos na Frota</CardTitle>
            <Truck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{summary?.activeVehicles ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Ativos operacionais cadastrados</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Frotas (Grupos)</CardTitle>
            <FolderOpen className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{summary?.activeFleets ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Centros de custo e bases</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{summary?.activeEmployees ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Motoristas e operadores de campo</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Acessos Administrativos</CardTitle>
            <ShieldCheck className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{summary?.activeUsers ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Usuários de painel ativos</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Ocorrências & Não Conformidades
          </h2>
          {openNcs.length > 0 && (
            <Link href="/dashboard/ncs">
              <Button variant="ghost" size="sm" className="text-xs text-primary font-medium">
                Ver todas ({openNcs.length})
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="mt-4 p-8 bg-white border rounded-lg text-center text-sm text-slate-500 animate-pulse">
            Carregando ocorrências...
          </div>
        ) : openNcs.length === 0 ? (
          <div className="mt-4 bg-white border rounded-lg p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Operação 100% Conforme</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Não existem Não Conformidades (NCs) pendentes ou falhas críticas registradas na frota.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openNcs.slice(0, 3).map((nc) => (
              <Card key={nc.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      #{nc.id.substring(0, 6).toUpperCase()}
                    </span>
                    <Badge className={
                      nc.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                      nc.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      'bg-amber-100 text-amber-700'
                    }>
                      {nc.severity}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-2">
                    {nc.notes || 'Não conformidade registrada em inspeção.'}
                  </p>
                  <div className="mt-3 pt-3 border-t flex justify-end">
                    <Link href="/dashboard/ncs">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary font-medium px-2">
                        Tratar NC
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
