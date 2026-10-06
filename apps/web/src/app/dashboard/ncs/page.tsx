'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { NC } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertOctagon, Search, Activity, Calendar, AlertTriangle, MessageSquare, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NCsPage() {
  const [ncs, setNcs] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Treatment state
  const [editTarget, setEditTarget] = useState<NC | null>(null);
  const [editStatus, setEditStatus] = useState('IN_PROGRESS');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetchNCs();
  }, []);

  async function fetchNCs() {
    try {
      setLoading(true);
      const res = await api.get<NC[]>('/ncs');
      setNcs(res.data);
    } catch {
      console.error('Falha ao buscar NCs');
    } finally {
      setLoading(false);
    }
  }

  function startTreatment(nc: NC) {
    setEditTarget(nc);
    setEditStatus(nc.status === 'OPEN' ? 'IN_PROGRESS' : nc.status);
    setEditNotes(nc.notes || '');
  }

  async function handleSaveTreatment(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    try {
      setEditSubmitting(true);
      await api.patch(`/ncs/${editTarget.id}`, {
        status: editStatus,
        notes: editNotes
      });
      setEditTarget(null);
      fetchNCs();
    } catch {
      alert('Não foi possível atualizar a não conformidade.');
    } finally {
      setEditSubmitting(false);
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case 'CRITICAL':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200"><AlertOctagon className="h-3 w-3 mr-1" /> Crítico</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"><AlertTriangle className="h-3 w-3 mr-1" /> Alto</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">Médio</Badge>;
      case 'LOW':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Baixo</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Aberto</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Em Tratativa</Badge>;
      case 'RESOLVED':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Resolvido</Badge>;
      case 'CLOSED':
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Encerrado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  const filteredNCs = ncs.filter(nc => {
    const matchesSearch = 
      nc.id.toLowerCase().includes(search.toLowerCase()) ||
      (nc.notes && nc.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesSeverity = severityFilter === 'ALL' || nc.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Não Conformidades (NC)</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie e trate as falhas e problemas apontados nas inspeções.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-700">Painel de Tratativas</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Buscar por código ou nota..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50" 
              />
            </div>
            <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val || 'ALL')}>
              <SelectTrigger className="h-9 w-36 text-xs bg-slate-50">
                <SelectValue placeholder="Todas as gravidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as gravidades</SelectItem>
                <SelectItem value="CRITICAL">Crítico</SelectItem>
                <SelectItem value="HIGH">Alto</SelectItem>
                <SelectItem value="MEDIUM">Médio</SelectItem>
                <SelectItem value="LOW">Baixo</SelectItem>
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
          ) : ncs.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <AlertOctagon className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Tudo em ordem</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Nenhuma não conformidade pendente de resolução no momento.
              </p>
            </div>
          ) : filteredNCs.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhuma não conformidade encontrada para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[15%]">Abertura</TableHead>
                  <TableHead className="w-[10%]">Código</TableHead>
                  <TableHead className="w-[15%]">Severidade</TableHead>
                  <TableHead className="w-[30%] hidden sm:table-cell">Anotações do Inspetor</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="text-right w-[15%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNCs.map((nc) => (
                  <TableRow key={nc.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center text-slate-900 font-medium">
                        <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                        {format(new Date(nc.createdAt), "dd/MM/yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        #{nc.id.substring(0,6).toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getSeverityBadge(nc.severity)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {nc.notes ? (
                        <div className="flex items-start text-sm text-slate-600">
                          <MessageSquare className="h-4 w-4 mr-2 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{nc.notes}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm italic">Sem anotações complementares</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(nc.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs font-medium text-slate-700 bg-white"
                        onClick={() => startTreatment(nc)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5 text-primary" />
                        Tratar NC
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* NC Treatment Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tratativa de Não Conformidade</DialogTitle>
            <DialogDescription>
              Atualize o andamento ou encerre a tratativa da NC #{editTarget?.id.substring(0, 6).toUpperCase()}.
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <form onSubmit={handleSaveTreatment} className="space-y-4 pt-2">
              <div className="p-3 bg-slate-50 border rounded-md text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gravidade:</span>
                  <span>{getSeverityBadge(editTarget.severity)}</span>
                </div>
                {editTarget.answer?.item && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Item:</span>
                    <span className="font-semibold text-slate-800">{editTarget.answer.item.text}</span>
                  </div>
                )}
                {editTarget.answer?.checklist?.vehicle && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Veículo:</span>
                    <span className="font-semibold text-slate-800">{editTarget.answer.checklist.vehicle.plate}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nc-status">Status da Tratativa *</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v || 'IN_PROGRESS')}>
                  <SelectTrigger id="nc-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Aberta (Sem ação)</SelectItem>
                    <SelectItem value="IN_PROGRESS">Em Tratativa / Manutenção</SelectItem>
                    <SelectItem value="RESOLVED">Resolvido / Corrigido</SelectItem>
                    <SelectItem value="CLOSED">Encerrado e Validado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nc-notes">Observações / Parecer Técnico</Label>
                <Input
                  id="nc-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Pneu trocado e calibrado na borracharia parceira em 06/10"
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={editSubmitting}>
                  {editSubmitting ? 'Salvando...' : 'Salvar Tratativa'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
