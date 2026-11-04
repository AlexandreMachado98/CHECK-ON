'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { apiErrorMessage, type NC, type NCStatus } from '@/lib/types';
import { NC_STATUS, NcSeverityBadge, NcStatusBadge, VehicleStatusBadge, isActiveNc } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [editStatus, setEditStatus] = useState<NCStatus>('IN_PROGRESS');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetchNCs();
  }, []);

  async function fetchNCs() {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get<NC[]>('/ncs');
      setNcs(res.data);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar as não conformidades.'));
    } finally {
      setLoading(false);
    }
  }

  function startTreatment(nc: NC) {
    setEditTarget(nc);
    setEditStatus(nc.status === 'OPEN' ? 'IN_PROGRESS' : nc.status);
    setEditNotes(nc.notes || '');
    setEditError('');
  }

  async function handleSaveTreatment(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    try {
      setEditSubmitting(true);
      setEditError('');
      await api.patch(`/ncs/${editTarget.id}`, { status: editStatus, notes: editNotes });
      setEditTarget(null);
      fetchNCs();
    } catch (error) {
      setEditError(apiErrorMessage(error, 'Não foi possível salvar a tratativa.'));
    } finally {
      setEditSubmitting(false);
    }
  }

  const counts = useMemo(() => ({
    active: ncs.filter(n => isActiveNc(n.status)).length,
    critical: ncs.filter(n => isActiveNc(n.status) && n.severity === 'CRITICAL').length,
    recurrent: ncs.filter(n => isActiveNc(n.status) && n.occurrences > 1).length,
  }), [ncs]);

  const filteredNCs = ncs.filter(nc => {
    const term = search.trim().toLowerCase();
    const haystack = [nc.id, nc.notes, itemOf(nc)?.text, vehicleOf(nc)?.plate, nc.answer?.checklist?.driver?.name]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !term || haystack.includes(term);
    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? isActiveNc(nc.status) : nc.status === statusFilter);
    const matchesSeverity = severityFilter === 'ALL' || nc.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const isClosed = editTarget?.status === 'CLOSED';

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

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
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
          ) : ncs.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <AlertOctagon className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma não conformidade</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Quando um motorista apontar um item como não conforme, a NC aparece aqui automaticamente.
              </p>
            </div>
          ) : filteredNCs.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhuma não conformidade para os filtros escolhidos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Item apontado</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead className="text-center">Ocorrências</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNCs.map((nc) => {
                    const item = itemOf(nc);
                    const vehicle = vehicleOf(nc);
                    return (
                      <TableRow key={nc.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
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
                          {(nc.answer?.observations || nc.notes) && (
                            <p className="mt-0.5 flex items-start text-xs text-slate-500">
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0 text-slate-400" />
                              <span className="line-clamp-2">{nc.notes || nc.answer?.observations}</span>
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
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
                        <TableCell><NcSeverityBadge severity={nc.severity} /></TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${nc.occurrences > 1 ? 'text-amber-700' : 'text-slate-700'}`}>{nc.occurrences}</span>
                          {nc.lastOccurrenceAt && nc.occurrences > 1 && (
                            <span className="block text-[11px] text-slate-500">última {format(new Date(nc.lastOccurrenceAt), 'dd/MM')}</span>
                          )}
                        </TableCell>
                        <TableCell><NcStatusBadge status={nc.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium text-slate-700 bg-white"
                            onClick={() => startTreatment(nc)}
                          >
                            {nc.status === 'CLOSED' ? <Lock className="h-3.5 w-3.5 mr-1.5" /> : <Wrench className="h-3.5 w-3.5 mr-1.5 text-primary" />}
                            {nc.status === 'CLOSED' ? 'Ver' : 'Tratar'}
                          </Button>
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

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tratativa da NC #{editTarget?.id.substring(0, 6).toUpperCase()}</DialogTitle>
            <DialogDescription>
              {isClosed
                ? 'Esta NC foi encerrada e não pode mais ser alterada.'
                : 'Ao resolver ou encerrar, o status do veículo é recalculado com base nas NCs que continuam ativas.'}
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <form onSubmit={handleSaveTreatment} className="space-y-4 pt-2">
              <dl className="p-3 bg-slate-50 border rounded-md text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <dt className="text-slate-500">Item</dt>
                <dd className="font-semibold text-slate-800">{itemOf(editTarget)?.text ?? '—'}</dd>
                <dt className="text-slate-500">Veículo</dt>
                <dd className="font-semibold text-slate-800">{vehicleOf(editTarget)?.plate ?? '—'}</dd>
                <dt className="text-slate-500">Severidade</dt>
                <dd><NcSeverityBadge severity={editTarget.severity} /></dd>
                <dt className="text-slate-500">Ocorrências</dt>
                <dd className="text-slate-800">
                  {editTarget.occurrences}{editTarget.occurrences > 1 ? ' (apontada novamente em inspeções seguintes)' : ''}
                </dd>
                {editTarget.answer?.checklist?.driver && (
                  <>
                    <dt className="text-slate-500">Aberta por</dt>
                    <dd className="text-slate-800">{editTarget.answer.checklist.driver.name}</dd>
                  </>
                )}
                {editTarget.answer?.observations && (
                  <>
                    <dt className="text-slate-500">Relato</dt>
                    <dd className="text-slate-800">{editTarget.answer.observations}</dd>
                  </>
                )}
              </dl>

              {editTarget.answer?.photoUrl && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Evidência enviada pelo motorista</p>
                  <a href={editTarget.answer.photoUrl} target="_blank" rel="noreferrer" className="block w-fit" title="Abrir foto em tamanho real">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editTarget.answer.photoUrl}
                      alt="Foto da não conformidade"
                      className="max-h-48 rounded-md border border-slate-200 object-cover"
                    />
                  </a>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nc-status">Status da tratativa</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus((v || 'IN_PROGRESS') as NCStatus)} disabled={isClosed}>
                  <SelectTrigger id="nc-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(NC_STATUS) as NCStatus[]).map(status => (
                      <SelectItem key={status} value={status}>{NC_STATUS[status].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editStatus === 'CLOSED' && !isClosed && (
                  <p className="text-xs text-amber-800">Depois de encerrada, a NC não pode ser reaberta.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nc-notes">Parecer técnico</Label>
                <textarea
                  id="nc-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  disabled={isClosed}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  placeholder="Ex.: pneu trocado e calibrado na borracharia parceira em 06/11"
                />
              </div>

              {editError && <p className="text-sm text-rose-700" role="alert">{editError}</p>}

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                  {isClosed ? 'Fechar' : 'Cancelar'}
                </Button>
                {!isClosed && (
                  <Button type="submit" disabled={editSubmitting}>
                    {editSubmitting ? 'Salvando...' : 'Salvar tratativa'}
                  </Button>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`text-2xl font-bold ${tone}`}>{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${tone} opacity-70`} />
      </CardContent>
    </Card>
  );
}
