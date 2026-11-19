'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { matchesSearch } from '@/lib/search';
import api from '@/lib/api';
import { apiErrorMessage, type Vehicle, type VehicleStatus } from '@/lib/types';
import { VEHICLE_STATUS, VehicleStatusBadge } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertOctagon, Lock, Search, ShieldCheck, TriangleAlert, Truck, LockOpen } from 'lucide-react';

const TILES: { status: VehicleStatus; icon: React.ElementType; tone: string }[] = [
  { status: 'LIBERADO', icon: ShieldCheck, tone: 'text-emerald-700' },
  { status: 'ATENCAO', icon: TriangleAlert, tone: 'text-amber-700' },
  { status: 'BLOQUEADO', icon: Lock, tone: 'text-rose-700' },
];

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get<Vehicle[]>('/vehicles');
      setVehicles(res.data);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar os veículos.'));
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(vehicle: Vehicle, status: VehicleStatus) {
    const verb = status === 'BLOQUEADO' ? 'bloquear' : 'liberar';
    if (!window.confirm(`Deseja ${verb} o veículo ${vehicle.plate}?`)) return;
    try {
      setSavingId(vehicle.id);
      setRowError(null);
      await api.patch(`/vehicles/${vehicle.id}`, { status });
      await fetchVehicles();
    } catch (error) {
      setRowError({ id: vehicle.id, message: apiErrorMessage(error, `Não foi possível ${verb} o veículo.`) });
    } finally {
      setSavingId(null);
    }
  }

  const counts = useMemo(() => {
    const base: Record<VehicleStatus, number> = { LIBERADO: 0, ATENCAO: 0, BLOQUEADO: 0 };
    vehicles.filter(v => v.isActive).forEach(v => { base[(v.status ?? 'LIBERADO') as VehicleStatus]++; });
    return base;
  }, [vehicles]);

  const filtered = vehicles.filter(v => {
    // Placa sem hífen no cadastro: "abc-1234" também encontra "ABC1234".
    const found = matchesSearch(search, v.plate, v.prefix, v.brand, v.model, v.fleet?.name) || matchesSearch(search.replace(/[^a-zA-Z0-9]/g, ''), v.plate);
    return found && (statusFilter === 'ALL' || (v.status ?? 'LIBERADO') === statusFilter);
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Veículos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Situação operacional de cada veículo, calculada pelas não conformidades ativas.
          </p>
        </div>
        <Link href="/dashboard/fleets">
          <Button variant="outline"><Truck className="h-4 w-4 mr-2" />Cadastrar em Frotas</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        {TILES.map(({ status, icon: Icon, tone }) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(active ? 'ALL' : status)}
              className={`text-left rounded-xl border bg-white p-4 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{VEHICLE_STATUS[status].label}</span>
                <Icon className={`h-5 w-5 ${tone}`} />
              </div>
              <p className={`text-2xl font-bold ${tone}`}>{counts[status]}</p>
              <p className="text-xs text-slate-500">{VEHICLE_STATUS[status].description}</p>
            </button>
          );
        })}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-700">
            {statusFilter === 'ALL' ? 'Todos os veículos' : `Veículos com status ${VEHICLE_STATUS[statusFilter].label.toLowerCase()}`}
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar placa, modelo ou frota..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-slate-50"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Carregando veículos...
            </div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm">
              <p className="text-rose-700 mb-3">{loadError}</p>
              <Button variant="outline" size="sm" onClick={fetchVehicles}>Tentar de novo</Button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <p className="mb-3">Nenhum veículo cadastrado ainda.</p>
              <Link href="/dashboard/fleets"><Button size="sm">Cadastrar o primeiro veículo</Button></Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">Nenhum veículo para os filtros escolhidos.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead className="hidden md:table-cell">Veículo</TableHead>
                    <TableHead className="hidden lg:table-cell">Frota</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">NCs ativas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => {
                    const status = (v.status ?? 'LIBERADO') as VehicleStatus;
                    const activeNcs = v._count?.ncs ?? 0;
                    return (
                      <TableRow key={v.id} className={v.isActive ? '' : 'opacity-60'}>
                        <TableCell>
                          <span className="font-bold tracking-wide text-slate-900">{v.plate}</span>
                          {v.prefix && <span className="block text-xs text-slate-500">Prefixo {v.prefix}</span>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 hidden md:table-cell">
                          {[v.brand, v.model].filter(Boolean).join(' ') || '—'}{v.year ? ` (${v.year})` : ''}
                          {!v.isActive && <span className="block text-xs text-slate-500">Inativo</span>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 hidden lg:table-cell">{v.fleet?.name ?? '—'}</TableCell>
                        <TableCell><VehicleStatusBadge status={status} /></TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {activeNcs > 0 ? (
                            <Link href="/dashboard/ncs" className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:underline">
                              <AlertOctagon className="h-3.5 w-3.5" />{activeNcs}
                            </Link>
                          ) : <span className="text-slate-400">0</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {status === 'BLOQUEADO' ? (
                            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={savingId === v.id} onClick={() => changeStatus(v, activeNcs > 0 ? 'ATENCAO' : 'LIBERADO')}>
                              <LockOpen className="h-3.5 w-3.5 mr-1.5" />Liberar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8 text-xs text-rose-700" disabled={savingId === v.id} onClick={() => changeStatus(v, 'BLOQUEADO')}>
                              <Lock className="h-3.5 w-3.5 mr-1.5" />Bloquear
                            </Button>
                          )}
                          {rowError?.id === v.id && (
                            <p className="mt-1 max-w-xs text-left text-xs text-rose-700 sm:ml-auto" role="alert">{rowError.message}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
