'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Pagination } from '@/components/pagination';
import { useDebounced } from '@/lib/use-debounced';
import { apiErrorMessage, type NC, type PageResult } from '@/lib/types';
import { NcSeverityBadge, NcStatusBadge, VehicleStatusBadge } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NcTreatmentDialog } from '@/components/nc-treatment-dialog';
import { AlertOctagon, Activity, Calendar, Camera, Lock, MessageSquare, Repeat, Search, Truck, Wrench } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_FILTERS = [
  { value: 'ACTIVE', label: 'Ativas (abertas e em tratativa)' },
  { value: 'OPEN', label: 'Abertas' },
  { value: 'IN_PROGRESS', label: 'Em tratativa' },
  { value: 'RESOLVED', label: 'Resolvidas' },
  { value: 'CLOSED', label: 'Encerradas' },
  { value: 'ALL', label: 'Todas' },
];

function itemOf(nc: NC) {
  return nc.item ?? nc.answer?.item ?? null;
}
function vehicleOf(nc: NC) {
  return nc.vehicle ?? nc.answer?.checklist?.vehicle ?? null;
}

export default function NCsPage() {
  const [ncs, setNcs] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const [editTarget, setEditTarget] = useState<NC | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ active: 0, critical: 0, recurrent: 0 });
  const [hasAny, setHasAny] = useState(true);
  const debouncedSearch = useDebounced(search);
  const PAGE_SIZE = 50;

  // Nova busca ou filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, severityFilter]);

  useEffect(() => {
    fetchNCs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter, severityFilter]);

  async function fetchNCs() {
    try {
      setLoading(true);
      setLoadError('');
      // Lista paginada e filtrada no servidor; os contadores do topo vêm calculados.
      const res = await api.get<PageResult<NC> & { counts: { active: number; critical: number; recurrent: number } }>('/ncs', {
        params: { page, pageSize: PAGE_SIZE, search: debouncedSearch.trim() || undefined, status: statusFilter, severity: severityFilter },
      });
      setNcs(res.data.items);
      setTotal(res.data.total);
      setCounts(res.data.counts);
      // Sem filtro nenhum e sem resultado = empresa ainda sem NC (mensagem de "tudo certo").
      if (!debouncedSearch.trim() && statusFilter === 'ALL' && severityFilter === 'ALL') setHasAny(res.data.total > 0);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar as não conformidades.'));
    } finally {
      setLoading(false);
    }
  }

  function startTreatment(nc: NC) {
    setEditTarget(nc);
  }

  const filteredNCs = ncs;


  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Não Conformidades (NC)</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Falhas apontadas nas inspeções. Resolver as NCs de um veículo recalcula o status dele.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <SummaryTile label="NCs ativas" value={counts.active} icon={AlertOctagon} tone="text-slate-900" />
        <SummaryTile label="Críticas ativas (veículo bloqueado)" value={counts.critical} icon={Lock} tone="text-rose-700" />
        <SummaryTile label="Com reincidência" value={counts.recurrent} icon={Repeat} tone="text-amber-700" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-700">Painel de tratativas</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar placa, item, motorista..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'ACTIVE')}>
              <SelectTrigger className="h-9 w-56 text-xs bg-slate-50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val || 'ALL')}>
              <SelectTrigger className="h-9 w-40 text-xs bg-slate-50">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as severidades</SelectItem>
                <SelectItem value="CRITICAL">Crítica</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="LOW">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Carregando NCs...
            </div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm">
              <p className="text-rose-700 mb-3">{loadError}</p>
              <Button variant="outline" size="sm" onClick={fetchNCs}>Tentar de novo</Button>
            </div>
          ) : !hasAny ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <AlertOctagon className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma não conformidade</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Quando um motorista apontar um item como não conforme, a NC aparece aqui automaticamente.
              </p>
            </div>
          ) : total === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhuma não conformidade para os filtros escolhidos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="hidden md:table-cell">Abertura</TableHead>
                    <TableHead>Item apontado</TableHead>
                    <TableHead className="hidden sm:table-cell">Veículo</TableHead>
                    <TableHead className="hidden sm:table-cell">Severidade</TableHead>
                    <TableHead className="text-center hidden xl:table-cell">Ocorrências</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNCs.map((nc) => {
                    const item = itemOf(nc);
                    const vehicle = vehicleOf(nc);
                    return (
                      <TableRow key={nc.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => startTreatment(nc)}>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center text-slate-900 font-medium whitespace-nowrap">
                            <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            {format(new Date(nc.createdAt), 'dd/MM/yyyy')}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">#{nc.id.substring(0, 6).toUpperCase()}</span>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm font-medium text-slate-800">
                            {item?.text ?? 'Item removido do modelo'}
                            {nc.answer?.photoUrl && <Camera className="inline h-3.5 w-3.5 ml-1.5 text-sky-600" aria-label="Com foto" />}
                          </p>
                          {/* Celular: veículo, gravidade e situação embaixo do item (as colunas ficam escondidas). */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                            {vehicle && (
                              <span className="flex items-center text-xs font-medium text-slate-700">
                                <Truck className="h-3.5 w-3.5 mr-1 text-slate-400" />
                                {vehicle.plate}
                              </span>
                            )}
                            <NcSeverityBadge severity={nc.severity} />
                            <NcStatusBadge status={nc.status} />
                          </div>
                          {(nc.answer?.observations || nc.notes) && (
                            <p className="mt-0.5 flex items-start text-xs text-slate-500">
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0 text-slate-400" />
                              <span className="line-clamp-2">{nc.notes || nc.answer?.observations}</span>
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {vehicle ? (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center font-medium whitespace-nowrap">
                                <Truck className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                {vehicle.plate}
                              </span>
                              <VehicleStatusBadge status={vehicle.status} />
                            </div>
                          ) : <span className="text-sm text-slate-400">—</span>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><NcSeverityBadge severity={nc.severity} /></TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
                          <span className={`text-lg font-bold ${nc.occurrences > 1 ? 'text-amber-700' : 'text-slate-700'}`}>{nc.occurrences}</span>
                          {nc.lastOccurrenceAt && nc.occurrences > 1 && (
                            <span className="block text-[11px] text-slate-500">última {format(new Date(nc.lastOccurrenceAt), 'dd/MM')}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><NcStatusBadge status={nc.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium text-slate-700 bg-white"
                            onClick={(event) => { event.stopPropagation(); startTreatment(nc); }}
                          >
                            {nc.status === 'CLOSED' ? <Lock className="h-3.5 w-3.5 sm:mr-1.5" /> : <Wrench className="h-3.5 w-3.5 sm:mr-1.5 text-primary" />}
                            <span className="hidden sm:inline">{nc.status === 'CLOSED' ? 'Ver' : 'Tratar'}</span>
                            <span className="sr-only sm:hidden">{nc.status === 'CLOSED' ? 'Ver' : 'Tratar'}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && !loadError && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} noun="não conformidades" />
          )}
        </CardContent>
      </Card>

      <NcTreatmentDialog nc={editTarget} onClose={() => setEditTarget(null)} onSaved={fetchNCs} />
    </>
  );
}

function SummaryTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    // No celular os três cabem lado a lado (antes ocupavam a primeira tela inteira).
    <Card className="border-slate-200 shadow-sm py-0">
      <CardContent className="p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] leading-tight sm:text-xs font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-xl sm:text-2xl font-bold ${tone}`}>{value}</p>
        </div>
        <Icon className={`hidden sm:block h-5 w-5 shrink-0 ${tone} opacity-70`} />
      </CardContent>
    </Card>
  );
}
