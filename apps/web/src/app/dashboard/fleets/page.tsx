'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Fleet, Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Plus, Search, Edit2, Archive, Activity, Truck } from 'lucide-react';

export default function FleetsPage() {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state for Fleet
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Edit Fleet state
  const [editTarget, setEditTarget] = useState<Fleet | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Add Vehicle directly to Fleet state
  const [addVehicleFleet, setAddVehicleFleet] = useState<Fleet | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    prefix: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
  });
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

  // View Fleet Vehicles Modal
  const [viewVehiclesFleet, setViewVehiclesFleet] = useState<Fleet | null>(null);

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

  // Handle registering a vehicle directly into this fleet
  async function handleAddVehicleToFleet(e: React.FormEvent) {
    e.preventDefault();
    if (!addVehicleFleet) return;
    setVehicleSubmitting(true);
    try {
      await api.post('/vehicles', {
        plate: vehicleForm.plate.trim().toUpperCase(),
        prefix: vehicleForm.prefix.trim() || undefined,
        brand: vehicleForm.brand.trim() || undefined,
        model: vehicleForm.model.trim() || undefined,
        year: Number(vehicleForm.year) || undefined,
        fleetId: addVehicleFleet.id,
      });
      alert(`Veículo ${vehicleForm.plate.toUpperCase()} cadastrado com sucesso na frota "${addVehicleFleet.name}"!`);
      setAddVehicleFleet(null);
      setVehicleForm({
        plate: '',
        prefix: '',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
      });
      fetchFleets();
    } catch {
      alert('Erro ao cadastrar veículo na frota. Verifique se a placa já existe.');
    } finally {
      setVehicleSubmitting(false);
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Frotas & Veículos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie os agrupamentos da sua operação e cadastre os veículos vinculados a cada frota.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="shrink-0 shadow-xs" 
            onClick={() => setIsDialogOpen(true)}
          >
            <FolderOpen className="mr-2 h-4 w-4 text-slate-500" />
            Nova Frota
          </Button>

          <Button 
            className="shrink-0 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white" 
            onClick={() => {
              if (fleets.length === 0) {
                alert('Cadastre uma frota primeiro para associar seu veículo.');
                setIsDialogOpen(true);
              } else {
                setAddVehicleFleet(fleets[0]);
              }
            }}
          >
            <Truck className="mr-2 h-4 w-4" />
            Cadastrar Veículo
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Frota</DialogTitle>
              <DialogDescription>
                Crie um novo grupo para organizar seus veículos (ex: Base Norte, Vans de Entrega, Carretas).
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
                  placeholder="Ex: Veículos pesados de transferência interestadual"
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
          <CardTitle className="text-base font-semibold text-slate-700">Relação de Frotas & Veículos</CardTitle>
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
                  <TableHead className="w-[28%]">Nome do Grupo</TableHead>
                  <TableHead className="w-[20%]">Veículos Vinculados</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead className="w-[12%]">Situação</TableHead>
                  <TableHead className="text-right w-[20%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFleets.map(fleet => {
                  const vCount = fleet.vehicles?.length ?? fleet._count?.vehicles ?? 0;
                  return (
                    <TableRow key={fleet.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center">
                          <FolderOpen className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                          {fleet.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="font-medium bg-blue-50/50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => setViewVehiclesFleet(fleet)}
                            title="Clique para ver os veículos desta frota"
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            {vCount} {vCount === 1 ? 'veículo' : 'veículos'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:bg-primary/10 px-2 font-medium"
                            onClick={() => setAddVehicleFleet(fleet)}
                            title={`Cadastrar veículo diretamente em ${fleet.name}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Novo Veículo
                          </Button>
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
                        <div className="flex justify-end gap-1.5">
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Cadastrar Veículo Dentro da Frota */}
      <Dialog open={!!addVehicleFleet} onOpenChange={(open) => !open && setAddVehicleFleet(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Cadastrar Veículo na Frota
            </DialogTitle>
            <DialogDescription>
              Adicionando novo veículo ao grupo <strong>{addVehicleFleet?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddVehicleToFleet} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="v-fleet">Frota de Destino *</Label>
              <select
                id="v-fleet"
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white"
                value={addVehicleFleet?.id || ''}
                onChange={(e) => {
                  const found = fleets.find(f => f.id === e.target.value);
                  if (found) setAddVehicleFleet(found);
                }}
              >
                {fleets.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-plate">Placa do Veículo *</Label>
                <Input
                  id="v-plate"
                  placeholder="ABC-1234 / ABC1D23"
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-prefix">Prefixo / Código</Label>
                <Input
                  id="v-prefix"
                  placeholder="Ex: V-101"
                  value={vehicleForm.prefix}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, prefix: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-brand">Marca</Label>
                <Input
                  id="v-brand"
                  placeholder="Ex: Volvo, Scania, Iveco"
                  value={vehicleForm.brand}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-model">Modelo</Label>
                <Input
                  id="v-model"
                  placeholder="Ex: FH 540, Daily 35S14"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-year">Ano de Fabricação</Label>
              <Input
                id="v-year"
                type="number"
                value={vehicleForm.year}
                onChange={(e) => setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setAddVehicleFleet(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={vehicleSubmitting || !vehicleForm.plate.trim()}>
                {vehicleSubmitting ? 'Cadastrando...' : 'Cadastrar Veículo na Frota'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver Veículos da Frota */}
      <Dialog open={!!viewVehiclesFleet} onOpenChange={(open) => !open && setViewVehiclesFleet(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Veículos da Frota: {viewVehiclesFleet?.name}
            </DialogTitle>
            <DialogDescription>
              Lista de veículos atualmente vinculados a este grupo operacional.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {!viewVehiclesFleet?.vehicles || viewVehiclesFleet.vehicles.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <p>Nenhum veículo cadastrado nesta frota ainda.</p>
                <Button 
                  size="sm" 
                  className="mt-3"
                  onClick={() => {
                    const currentFleet = viewVehiclesFleet;
                    setViewVehiclesFleet(null);
                    setAddVehicleFleet(currentFleet);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Cadastrar Primeiro Veículo
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                {viewVehiclesFleet.vehicles.map((v: Vehicle) => (
                  <div key={v.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {v.plate}
                        {v.prefix && (
                          <Badge variant="outline" className="text-xs font-normal">
                            Prefixo: {v.prefix}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {v.brand || ''} {v.model || ''} {v.year ? `(${v.year})` : ''}
                      </div>
                    </div>
                    <Badge className={v.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"}>
                      {v.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                const currentFleet = viewVehiclesFleet;
                setViewVehiclesFleet(null);
                setAddVehicleFleet(currentFleet);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Mais Veículos
            </Button>
            <Button type="button" variant="outline" onClick={() => setViewVehiclesFleet(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

