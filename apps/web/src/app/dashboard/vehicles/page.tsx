'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { matchesSearch } from '@/lib/search';
import { canManage } from '@/lib/roles';
import { getStoredUser } from '@/lib/session';
import api from '@/lib/api';
import { apiErrorMessage, type Vehicle, type VehicleStatus } from '@/lib/types';
import { VEHICLE_STATUS, VehicleStatusBadge } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertOctagon, Lock, Search, ShieldCheck, TriangleAlert, Truck, LockOpen, QrCode, Printer, FileUp, Star } from 'lucide-react';
import { VehicleLabelsPrint, VehicleQrDialog, openLabelsWindow } from '@/components/vehicle-qr';
import { PassengerLabelsPrint, type PassengerLabel } from '@/components/passenger-qr';
import { formatKm } from '@/lib/utils';
import { VehicleImportDialog } from '@/components/vehicle-import';
import { confirmAction, notify } from '@/components/feedback';
import { useStoredUser } from '@/lib/use-stored-user';

const TILES: { status: VehicleStatus; icon: React.ElementType; tone: string }[] = [
  { status: 'LIBERADO', icon: ShieldCheck, tone: 'text-emerald-700' },
  { status: 'ATENCAO', icon: TriangleAlert, tone: 'text-amber-700' },
  { status: 'BLOQUEADO', icon: Lock, tone: 'text-rose-700' },
];

export default function VehiclesPage() {
  const manager = canManage(useStoredUser()?.role);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrVehicle, setQrVehicle] = useState<Vehicle | null>(null);
  // Impressão em lote das etiquetas: veículos da lista atual e a janela aberta no clique.
  const [batch, setBatch] = useState<{ vehicles: Vehicle[]; win: Window } | null>(null);
  // Adesivos "Como estou dirigindo?" (QR do passageiro) dos veículos da lista.
  const [passengerBatch, setPassengerBatch] = useState<{ labels: PassengerLabel[]; win: Window } | null>(null);
  const [passengerLoading, setPassengerLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
    if (!(await confirmAction({ message: `Deseja ${verb} o veículo ${vehicle.plate}?`, title: status === 'BLOQUEADO' ? 'Bloquear veículo' : 'Liberar veículo', confirmLabel: status === 'BLOQUEADO' ? 'Bloquear' : 'Liberar', danger: status === 'BLOQUEADO' }))) return;
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

  /** Adesivos do QR do passageiro dos veículos (cria os códigos que faltam). A janela abre no clique. */
  async function printPassengerQr(ids: string[]) {
    if (!ids.length) return;
    // A janela abre antes do await: depois dele o navegador bloquearia.
    const win = openLabelsWindow();
    if (!win) { notify('O navegador bloqueou a janela de impressão. Permita janelas deste site e tente de novo.'); return; }
    setPassengerLoading(true);
    try {
      const res = await api.post<PassengerLabel[]>('/driving-feedback/passenger-qr', { vehicleIds: ids });
      setPassengerBatch({ labels: res.data, win });
    } catch (err) {
      win.close();
      notify(apiErrorMessage(err, 'Não foi possível gerar os QR Codes do passageiro.'));
    } finally {
      setPassengerLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Veículos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Situação operacional de cada veículo, calculada pelas não conformidades ativas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={loading || !filtered.some((v) => v.isActive)}
            onClick={() => {
              const list = filtered.filter((v) => v.isActive);
              const win = openLabelsWindow();
              if (!win) { notify('O navegador bloqueou a janela de impressão. Permita janelas deste site e tente de novo.'); return; }
              setBatch({ vehicles: list, win });
            }}
            title="Etiquetas de QR Code dos veículos da lista, 6 por folha A4"
          >
            <Printer className="h-4 w-4 mr-2" />Imprimir etiquetas ({filtered.filter((v) => v.isActive).length})
          </Button>
          {manager && (
            <Button
              variant="outline"
              disabled={loading || passengerLoading || !filtered.some((v) => v.isActive)}
              title="Adesivos com o QR do passageiro (Como estou dirigindo?) dos veículos da lista, 4 por folha A4"
              onClick={() => printPassengerQr(filtered.filter((v) => v.isActive).map((v) => v.id))}
            >
              <Star className="h-4 w-4 mr-2" />QR do passageiro ({filtered.filter((v) => v.isActive).length})
            </Button>
          )}
          {manager && (
            <Button variant="outline" onClick={() => setImportOpen(true)} title="Cadastrar vários veículos de uma vez a partir de uma planilha">
              <FileUp className="h-4 w-4 mr-2" />Importar planilha
            </Button>
          )}
          {manager && <Link href="/dashboard/fleets">
            <Button variant="outline"><Truck className="h-4 w-4 mr-2" />Cadastrar em Frotas</Button>
          </Link>}
        </div>
      </div>

      {/* No celular os três cabem lado a lado (antes ocupavam a primeira tela inteira). */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        {TILES.map(({ status, icon: Icon, tone }) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(active ? 'ALL' : status)}
              className={`text-left rounded-xl border bg-white p-3 sm:p-4 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{VEHICLE_STATUS[status].label}</span>
                <Icon className={`hidden sm:block h-5 w-5 ${tone}`} />
              </div>
              {/* Carregando ou sem resposta da API: "—", não um 0 que parece frota toda liberada. */}
              <p className={`text-xl sm:text-2xl font-bold ${loading || loadError ? 'text-slate-300' : tone}`}>{loading || loadError ? '—' : counts[status]}</p>
              <p className="hidden sm:block text-xs text-slate-500">{VEHICLE_STATUS[status].description}</p>
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
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
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
                          {!!v.mileage && <span className="block text-xs tabular-nums text-slate-500">{formatKm(v.mileage)}</span>}
                          {!v.isActive && <span className="block text-xs text-slate-500">Inativo</span>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 hidden lg:table-cell">{v.fleet?.name ?? '—'}</TableCell>
                        <TableCell><VehicleStatusBadge status={status} /></TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {activeNcs > 0 ? (
                            <Link href="/dashboard/ncs" className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:underline">
                              <AlertOctagon className="h-3.5 w-3.5" />{activeNcs}
                            </Link>
                          ) : <span className="text-slate-500">0</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex flex-wrap justify-end gap-2">
                          {v.isActive && (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setQrVehicle(v)} aria-label={`QR Code de ${v.plate}`}>
                              <QrCode className="h-3.5 w-3.5 mr-1.5" />QR Code
                            </Button>
                          )}
                          {status === 'BLOQUEADO' ? (
                            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={savingId === v.id} onClick={() => changeStatus(v, activeNcs > 0 ? 'ATENCAO' : 'LIBERADO')}>
                              <LockOpen className="h-3.5 w-3.5 mr-1.5" />Liberar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8 text-xs text-rose-700" disabled={savingId === v.id} onClick={() => changeStatus(v, 'BLOQUEADO')}>
                              <Lock className="h-3.5 w-3.5 mr-1.5" />Bloquear
                            </Button>
                          )}
                          </div>
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
      <VehicleQrDialog
        vehicle={qrVehicle}
        onClose={() => setQrVehicle(null)}
        onPrintPassenger={manager && qrVehicle?.isActive ? () => printPassengerQr([qrVehicle.id]) : undefined}
        passengerLoading={passengerLoading}
      />
      <VehicleImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={fetchVehicles} exampleFleet={vehicles.find((v) => v.fleet?.name)?.fleet?.name} />
      {batch && <VehicleLabelsPrint vehicles={batch.vehicles} win={batch.win} onDone={() => setBatch(null)} />}
      {passengerBatch && <PassengerLabelsPrint labels={passengerBatch.labels} company={getStoredUser()?.tenantName || ''} win={passengerBatch.win} onDone={() => setPassengerBatch(null)} />}
    </>
  );
}
