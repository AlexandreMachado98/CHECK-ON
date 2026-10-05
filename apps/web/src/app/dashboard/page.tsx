'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Users, ShieldCheck, FolderOpen, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface DashboardSummary {
  activeVehicles: number;
  activeFleets: number;
  activeEmployees: number;
  activeUsers: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.get<DashboardSummary>('/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('Erro ao buscar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Visão geral da operação</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe a situação atual da frota, equipes e infraestrutura do sistema.
          </p>
        </div>
        {/* Placeholder for Date Filters as per rule 11 */}
        <div className="flex gap-2">
          <div className="bg-white border rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
            Unidade Matriz
          </div>
          <div className="bg-white border rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
            Hoje
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
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
            <p className="text-xs text-muted-foreground mt-1">Total de ativos operacionais</p>
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
            <p className="text-xs text-muted-foreground mt-1">Centros de custo cadastrados</p>
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
            <p className="text-xs text-muted-foreground mt-1">Motoristas e operadores</p>
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
        <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2 border-b pb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Requer atenção
        </h2>
        <div className="mt-4 bg-white border rounded-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-slate-900">Nenhuma ocorrência crítica</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Não existem Não Conformidades (NCs) críticas abertas ou planos de ação em atraso para a operação selecionada.
          </p>
        </div>
      </div>
    </>
  );
}
