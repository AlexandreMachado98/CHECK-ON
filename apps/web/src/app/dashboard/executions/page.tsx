'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Checklist } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Search, Activity, Calendar, Car, User, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ExecutionsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);

  useEffect(() => {
    fetchChecklists();
  }, []);

  async function fetchChecklists() {
    try {
      setLoading(true);
      const res = await api.get<Checklist[]>('/checklists');
      setChecklists(res.data);
    } catch {
      console.error('Falha ao buscar checklists');
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

  const filteredChecklists = checklists.filter(c => {
    const matchesSearch = 
      (c.vehicle?.plate && c.vehicle.plate.toLowerCase().includes(search.toLowerCase())) ||
      (c.driver?.name && c.driver.name.toLowerCase().includes(search.toLowerCase())) ||
      (c.template?.name && c.template.name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Buscar placa, motorista ou modelo..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50" 
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'ALL')}>
              <SelectTrigger className="h-9 w-36 text-xs bg-slate-50">
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
          ) : checklists.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <ClipboardList className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma inspeção registrada</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                As inspeções realizadas pelos motoristas no aplicativo aparecerão aqui.
              </p>
            </div>
          ) : filteredChecklists.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhuma inspeção encontrada para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[20%]">Data / Hora</TableHead>
                  <TableHead className="w-[20%]">Modelo</TableHead>
                  <TableHead className="w-[20%]">Veículo</TableHead>
                  <TableHead className="w-[20%]">Condutor</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="text-right w-[10%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecklists.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 flex items-center">
                          <Calendar className="h-3 w-3 mr-1.5 text-slate-400" />
                          {format(new Date(c.startedAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center mt-0.5">
                          <Clock className="h-3 w-3 mr-1.5 text-slate-400" />
                          {format(new Date(c.startedAt), "HH:mm")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {c.template?.name || 'Modelo não identificado'}
                    </TableCell>
                    <TableCell>
                      {c.vehicle ? (
                        <div className="flex items-center">
                          <Car className="h-4 w-4 mr-2 text-slate-400" />
                          <span className="font-medium">{c.vehicle.plate}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">N/D</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.driver ? (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-slate-400" />
                          <span className="text-sm">{c.driver.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">N/D</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(c.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => setSelectedChecklist(c)}
                      >
                        Ver Detalhes
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Itens Inspecionados</h4>
                {!selectedChecklist.answers || selectedChecklist.answers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 bg-slate-50/50 rounded text-center">
                    Nenhuma resposta registrada nesta execução.
                  </p>
                ) : (
                  <div className="divide-y border rounded-lg overflow-hidden">
                    {selectedChecklist.answers.map((ans) => (
                      <div key={ans.id} className="p-3 flex items-start justify-between gap-4 text-sm bg-white hover:bg-slate-50/50">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{ans.item?.text || 'Regra de inspeção'}</p>
                          {ans.nonConformity && (
                            <span className="inline-block mt-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium">
                              Não Conformidade Registrada: {ans.nonConformity.severity}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                            ans.value === 'CONFORME' || ans.value === 'OK' || ans.value === 'PASS' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : ans.value === 'NAO_CONFORME' || ans.value === 'NC' || ans.value === 'FAIL'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ans.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
