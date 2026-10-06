'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Fleet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Plus, Search, Edit2, Archive, Activity } from 'lucide-react';

export default function FleetsPage() {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Edit state
  const [editTarget, setEditTarget] = useState<Fleet | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetchFleets();
  }, []);

  async function fetchFleets() {
    try {
      setLoading(true);
      const response = await api.get('/fleets');
      setFleets(response.data);
    } catch {
      console.error('Failed to fetch fleets');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/fleets', { name, description });
      setIsDialogOpen(false);
      setName('');
      setDescription('');
      fetchFleets();
    } catch {
      alert('Não foi possível cadastrar a frota.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSubmitting(true);
    try {
      await api.patch(`/fleets/${editTarget.id}`, { name: editName, description: editDesc });
      setEditTarget(null);
      fetchFleets();
    } catch {
      alert('Erro ao atualizar dados da frota.');
    } finally {
      setEditSubmitting(false);
    }
  }

  function startEdit(fleet: Fleet) {
    setEditTarget(fleet);
    setEditName(fleet.name);
    setEditDesc(fleet.description || '');
  }

  async function handleToggleStatus(fleet: Fleet) {
    try {
      await api.patch(`/fleets/${fleet.id}`, { isActive: !fleet.isActive });
      fetchFleets();
    } catch {
      alert('Erro ao alterar situação da frota.');
    }
  }

  const filteredFleets = fleets.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Frotas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie os agrupamentos, garagens ou centros de custo da sua operação.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Grupo de Frota
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Frota</DialogTitle>
              <DialogDescription>
                Crie um novo agrupamento para organizar seus veículos (ex: Base Norte, Vans de Entrega).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Frota *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Base Sul Operacional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição / Observações</Label>
                <Input
                  id="desc"
                  placeholder="Ex: Veículos leves destinados a operações expressas"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || !name}>
                  {submitting ? 'Salvando...' : 'Salvar Frota'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Relação de Frotas</CardTitle>
          <div className="relative w-64 hidden sm:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Buscar frota..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm" 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Carregando dados da frota...
            </div>
          ) : fleets.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center">
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <FolderOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma frota cadastrada</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-4">
                Organize seus veículos criando grupos. Cadastre sua primeira frota para continuar.
              </p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Cadastrar Frota
              </Button>
            </div>
          ) : filteredFleets.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhuma frota encontrada para a busca &quot;{search}&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[30%]">Nome do Grupo</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead className="w-[15%]">Situação</TableHead>
                  <TableHead className="text-right w-[15%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFleets.map(fleet => (
                  <TableRow key={fleet.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center">
                        <FolderOpen className="h-4 w-4 text-slate-400 mr-2" />
                        {fleet.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 hidden md:table-cell">
                      {fleet.description || <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`font-medium ${
                          fleet.isActive 
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200'
                        }`}
                      >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${fleet.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {fleet.isActive ? 'Em Operação' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-primary"
                          onClick={() => startEdit(fleet)}
                          title="Editar frota"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${fleet.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleToggleStatus(fleet)}
                          title={fleet.isActive ? "Arquivar/Inativar" : "Reativar"}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Fleet Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grupo de Frota</DialogTitle>
            <DialogDescription>
              Atualize o nome e as observações desta frota operacional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome da Frota *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descrição / Observações</Label>
              <Input
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting || !editName.trim()}>
                {editSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
