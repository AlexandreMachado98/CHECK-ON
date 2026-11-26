'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { apiErrorMessage, type Checklist, type ChecklistAnswer, type PageResult } from '@/lib/types';
import { Pagination } from '@/components/pagination';
import { useDebounced } from '@/lib/use-debounced';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Search, Activity, Calendar, Car, User, Clock, ArrowRight, MessageSquare, Download, Trash2 } from 'lucide-react';
import { seesAllUnits } from '@/lib/roles';
import { getStoredUser } from '@/lib/session';
import { NC_SEVERITY, NC_STATUS } from '@/lib/status';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { photoAtWidth } from '@/lib/photo-url';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notify, confirmAction } from '@/components/feedback';

export default function ExecutionsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [pdfWorking, setPdfWorking] = useState(false);
  // Excluir inspeção: só o administrador (não tem como desfazer).
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => { setCanDelete(seesAllUnits(getStoredUser()?.role)); }, []);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const checklist = selectedChecklist;
    if (!checklist) return;
    const when = checklist.completedAt || checklist.startedAt;
    const label = `${checklist.vehicle?.plate ?? 'veículo'} · ${when ? format(new Date(when), "dd/MM/yyyy 'às' HH:mm") : ''}`;
    const ok = (await confirmAction({ message: `Excluir a inspeção ${label}?\n\nSerão apagadas as respostas, as fotos, a assinatura e as NCs abertas por ela. ` +
        'A situação do veículo é recalculada. Não tem como desfazer.', title: 'Excluir inspeção', confirmLabel: 'Excluir', danger: true }));
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/checklists/${checklist.id}`);
      setSelectedChecklist(null);
      await fetchChecklists();
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível excluir a inspeção.'));
    } finally {
      setDeleting(false);
    }
  }

  /** PDF da inspeção aberta (gerado no navegador, com as fotos). */
  async function handleDownloadPdf() {
    if (!selectedChecklist?.answers) return;
    setPdfWorking(true);
    try {
      const { downloadChecklistPdf } = await import('@/lib/checklist-pdf');
      const user = getStoredUser();
      await downloadChecklistPdf(selectedChecklist, { companyName: user?.tenantName, generatedBy: user?.name });
    } catch (error) {
      console.error('Falha ao gerar o PDF', error);
      notify('Não foi possível gerar o PDF desta inspeção. Tente de novo.');
    } finally {
      setPdfWorking(false);
    }
  }
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounced(search);
  const PAGE_SIZE = 50;

  // Nova busca ou filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchChecklists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter]);

  async function fetchChecklists() {
    try {
      setLoading(true);
      setLoadError('');
      // Lista paginada e filtrada no servidor; as respostas de cada inspeção vêm só nos detalhes.
      const res = await api.get<PageResult<Checklist>>('/checklists', {
        params: { page, pageSize: PAGE_SIZE, search: debouncedSearch.trim() || undefined, status: statusFilter },
      });
      setChecklists(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Falha ao buscar checklists', error);
      setLoadError(apiErrorMessage(error, 'Não foi possível carregar as inspeções.'));
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'IN_PROGRESS':
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">Em Andamento</Badge>;
      case 'COMPLETED':
      case 'SYNCED':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Finalizado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  const filteredChecklists = checklists;
  const hasFilters = !!debouncedSearch.trim() || statusFilter !== 'ALL';

  async function openDetails(checklist: Checklist) {
    setSelectedChecklist(checklist);
    setDetailError('');
    setDetailLoading(true);
    try {
      const res = await api.get<Checklist>(`/checklists/${checklist.id}`);
      setSelectedChecklist(res.data);
    } catch (error) {
      setDetailError(apiErrorMessage(error, 'Não foi possível carregar os itens desta inspeção.'));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inspeções Realizadas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Histórico completo de checklists e vistorias executadas em campo.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-700">Histórico de Execuções</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                type="text" 
                placeholder="Buscar placa, motorista ou modelo..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50" 
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'ALL')}>
              <SelectTrigger aria-label="Filtrar por situação" className="h-9 w-36 text-xs bg-slate-50">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                <SelectItem value="COMPLETED">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Carregando inspeções...
            </div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm">
              <p className="text-rose-700 mb-3">{loadError}</p>
              <Button variant="outline" size="sm" onClick={fetchChecklists}>Tentar de novo</Button>
            </div>
          ) : total === 0 && !hasFilters ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <ClipboardList className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma inspeção registrada</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                As inspeções realizadas pelos motoristas no aplicativo aparecerão aqui.
              </p>
            </div>
          ) : total === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhuma inspeção encontrada para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[20%]">Data / Hora</TableHead>
                  <TableHead className="w-[20%] hidden md:table-cell">Modelo</TableHead>
                  <TableHead className="w-[20%]">Veículo</TableHead>
                  <TableHead className="w-[20%] hidden xl:table-cell">Condutor</TableHead>
                  <TableHead className="w-[10%] hidden sm:table-cell">Itens NC</TableHead>
                  <TableHead className="w-[10%] hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right w-[10%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecklists.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => openDetails(c)}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 flex items-center">
                          <Calendar className="h-3 w-3 mr-1.5 text-slate-500" />
                          {format(new Date(c.startedAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center mt-0.5">
                          <Clock className="h-3 w-3 mr-1.5 text-slate-500" />
                          {format(new Date(c.startedAt), "HH:mm")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 hidden md:table-cell">
                      {c.templateName || c.template?.name || 'Modelo não identificado'}
                    </TableCell>
                    <TableCell className="min-w-0">
                      {c.vehicle ? (
                        <div className="flex items-center">
                          <Car className="h-4 w-4 mr-2 text-slate-500" />
                          <span className="font-medium">{c.vehicle.plate}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">N/D</span>
                      )}
                      {/* Celular: o que as colunas escondidas mostram, embaixo da placa. */}
                      <p className="mt-0.5 max-w-[8.5rem] truncate text-xs text-slate-500 sm:max-w-[14rem] xl:hidden">
                        {c.driver?.name}
                        {/* O modelo tem coluna própria a partir do tablet. */}
                        <span className="md:hidden">{c.driver?.name ? ' · ' : ''}{c.templateName || c.template?.name}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                        {getStatusBadge(c.status)}
                        {(() => {
                          const nc = c.ncCount ?? c.answers?.filter(a => !a.isCompliant).length ?? 0;
                          return nc > 0 ? <span className="text-xs font-semibold text-rose-700">{nc} {nc === 1 ? 'item NC' : 'itens NC'}</span> : null;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {c.driver ? (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-slate-500" />
                          <span className="text-sm">{c.driver.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">N/D</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(() => {
                        const nc = c.ncCount ?? c.answers?.filter(a => !a.isCompliant).length ?? 0;
                        return nc > 0
                          ? <span className="text-sm font-semibold text-rose-700">{nc}</span>
                          : <span className="text-sm text-slate-500">0</span>;
                      })()}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {getStatusBadge(c.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary hover:bg-primary/10"
                        onClick={(event) => { event.stopPropagation(); openDetails(c); }}
                      >
                        <span className="hidden xl:inline">Ver Detalhes</span>
                        <span className="sr-only xl:hidden">Ver detalhes</span>
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && !loadError && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} noun="inspeções" />
          )}
        </CardContent>
      </Card>

      {/* Checklist Details Dialog */}
      <Dialog open={!!selectedChecklist} onOpenChange={(open) => !open && setSelectedChecklist(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Detalhes da Inspeção</DialogTitle>
            <DialogDescription>
              {selectedChecklist?.template?.name || 'Inspeção Operacional'} realizada em {selectedChecklist?.startedAt ? format(new Date(selectedChecklist.startedAt), "dd/MM/yyyy 'às' HH:mm") : '—'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || !selectedChecklist}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                title="Excluir esta inspeção (só o administrador)"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={detailLoading || !!detailError || !selectedChecklist?.answers || pdfWorking}
              title="Relatório da inspeção com as respostas e as fotos"
            >
              <Download className="mr-2 h-4 w-4" />
              {pdfWorking ? 'Gerando PDF...' : 'Baixar PDF'}
            </Button>
          </div>

          {selectedChecklist && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Veículo</span>
                  <span className="font-semibold text-slate-800">{selectedChecklist.vehicle?.plate || '—'}</span>
                  {selectedChecklist.vehicle?.model && (
                    <span className="text-xs text-slate-500 block">{selectedChecklist.vehicle.model}</span>
                  )}
                </div>
                {selectedChecklist.vehicle?.fleet && (
                  <div>
                    <span className="text-xs text-slate-500 block">Frota / frente</span>
                    <span className="font-semibold text-slate-800">{selectedChecklist.vehicle.fleet.name}</span>
                    {selectedChecklist.vehicle.fleet.unit && (
                      <span className="text-xs text-slate-500 block">{selectedChecklist.vehicle.fleet.unit.name}</span>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-500 block">Condutor / Inspetor</span>
                  <span className="font-semibold text-slate-800">{selectedChecklist.driver?.name || '—'}</span>
                  {selectedChecklist.driver?.role && (
                    <span className="text-xs text-slate-500 block">{selectedChecklist.driver.role}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Situação</span>
                  <div className="mt-1">{getStatusBadge(selectedChecklist.status)}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Não conformidades</span>
                  <span className="font-semibold text-slate-800">
                    {selectedChecklist.answers
                      ? (() => {
                          // Itens "não se aplica" ficam fora da conta.
                          const applicable = selectedChecklist.answers.filter((a) => !a.notApplicable);
                          const na = selectedChecklist.answers.length - applicable.length;
                          return `${applicable.filter((a) => !a.isCompliant).length} de ${applicable.length} itens${na ? ` (${na} N/A)` : ''}`;
                        })()
                      : `${selectedChecklist.ncCount ?? 0} item(ns)`}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Concluída em</span>
                  <span className="font-semibold text-slate-800">
                    {selectedChecklist.completedAt ? format(new Date(selectedChecklist.completedAt), "dd/MM/yyyy HH:mm") : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Recebida pelo servidor</span>
                  <span className="font-semibold text-slate-800">
                    {selectedChecklist.syncedAt ? format(new Date(selectedChecklist.syncedAt), "dd/MM/yyyy HH:mm") : '—'}
                  </span>
                  {selectedChecklist.clientId && (
                    <span className="text-[11px] text-slate-500 block font-mono" title={selectedChecklist.clientId}>
                      app {selectedChecklist.clientId.slice(0, 8)}
                    </span>
                  )}
                </div>
                {selectedChecklist.deviceInfo && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-xs text-slate-500 block">Enviada do aparelho</span>
                    <span className="text-xs text-slate-700 break-words">{selectedChecklist.deviceInfo}</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Itens Inspecionados</h4>
                {detailLoading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Carregando itens da inspeção...</p>
                ) : detailError ? (
                  <p className="text-sm text-rose-700 py-4 text-center">{detailError}</p>
                ) : !selectedChecklist.answers || selectedChecklist.answers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 bg-slate-50/50 rounded text-center">
                    Nenhuma resposta registrada nesta execução.
                  </p>
                ) : (
                  <div className="divide-y border rounded-lg overflow-hidden">
                    {selectedChecklist.answers.map((ans) => (
                      <div key={ans.id} className="p-3 flex items-start justify-between gap-4 text-sm bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800">
                            {ans.item?.text || 'Item de inspeção'}
                            {ans.item?.isCritical && <span className="ml-2 text-[11px] font-semibold text-rose-600">crítico</span>}
                          </p>
                          <AnswerValue answer={ans} />
                          {ans.observations && (
                            <p className="mt-1 text-xs text-slate-600 flex items-start gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
                              {ans.observations}
                            </p>
                          )}
                          {ans.nonConformity && (
                            <span className="inline-block mt-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium">
                              Abriu NC {NC_SEVERITY[ans.nonConformity.severity]?.label.toLowerCase() ?? ''} · {NC_STATUS[ans.nonConformity.status]?.label ?? ans.nonConformity.status}
                            </span>
                          )}
                          {ans.recurrentNcId && !ans.nonConformity && (
                            <span className="inline-block mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                              Reincidência: somada a uma NC que já estava em tratativa
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            title={ans.notApplicable ? 'Não se aplica: o item não existe neste veículo' : undefined}
                            className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                              ans.notApplicable ? 'bg-slate-100 text-slate-600' : ans.isCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {ans.notApplicable ? 'N/A' : ans.isCompliant ? 'Conforme' : 'Não conforme'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Assinatura</h4>
                {selectedChecklist.signatureUrl ? (
                  <div className="rounded-lg border bg-white p-3 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedChecklist.signatureUrl} alt={`Assinatura de ${selectedChecklist.signedName ?? 'colaborador'}`} className="mx-auto h-24 w-auto max-w-full object-contain" />
                    <div className="mx-auto mt-1 w-64 max-w-full border-t border-slate-300 pt-1 text-sm font-medium text-slate-800">
                      {selectedChecklist.signedName || selectedChecklist.driver?.name}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Sem assinatura (inspeção feita numa versão do aplicativo anterior à assinatura).</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnswerValue({ answer }: { answer: ChecklistAnswer }) {
  const parts: string[] = [];
  if (answer.numberValue !== null && answer.numberValue !== undefined) parts.push(answer.numberValue.toLocaleString('pt-BR'));
  if (answer.textValue) parts.push(answer.textValue);
  if (parts.length === 0 && !answer.photoUrl) return null;
  return (
    <div className="mt-1 text-sm text-slate-700">
      {parts.join(' · ')}
      {answer.photoUrl && (
        <a href={answer.photoUrl} target="_blank" rel="noreferrer" className="mt-2 block w-fit" title="Abrir foto em tamanho real">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoAtWidth(answer.photoUrl, 320)}
            alt={`Foto do item ${answer.item?.text ?? ''}`}
            loading="lazy"
            className="h-24 w-32 rounded-md border border-slate-200 object-cover"
          />
        </a>
      )}
    </div>
  );
}
