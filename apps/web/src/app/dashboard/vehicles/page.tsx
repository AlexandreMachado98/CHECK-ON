'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Vehicle, Fleet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Truck, Plus, Search, Edit2, CheckCircle2, ShieldOff, Activity, FolderOpen, Archive } from 'lucide-react';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<(Vehicle & { fleet: Fleet })[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [licensePlate, setLicensePlate] = useState('');
  const [model, setModel] = useState('');
  const [prefix, setPrefix] = useState('');
  const [fleetId, setFleetId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicles();
    fetchFleets();
  }, []);

  async function fetchVehicles() {
    try {
      setLoading(true);
      const response = await api.get('/vehicles');
      setVehicles(response.data);
    } catch (error) {
      console.error('Failed to fetch vehicles', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFleets() {
    try {
      const response = await api.get('/fleets');
      setFleets(response.data.filter((f: Fleet) => f.isActive));
    } catch (error) {
      console.error('Failed to fetch fleets', error);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/vehicles', { 
        licensePlate: licensePlate.toUpperCase(), 
        model, 
        prefix: prefix.toUpperCase() || undefined,
        fleetId 
      });
      setIsDialogOpen(false);
      
      // reset form
      setLicensePlate('');
      setModel('');
      setPrefix('');
      setFleetId('');
      
      fetchVehicles();
    } catch {
      alert('Não foi possível cadastrar o veículo.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(vehicle: Vehicle) {
    try {
      await api.patch(`/vehicles/${vehicle.id}`, { isActive: !vehicle.isActive });
      fetchVehicles();
    } catch {
      alert('Erro ao alterar situação do veículo.');
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Veículos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie sua frota, verifique pendências e acompanhe inspeções.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Veículo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Veículo</DialogTitle>
              <DialogDescription>
                Cadastre a placa e o modelo para inseri-lo na operação e associar aos checklists.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plate">Placa *</Label>
                  <Input
                    id="plate"
                    placeholder="ABC-1234"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefixo / Frota</Label>
                  <Input
                    id="prefix"
                    placeholder="TRK-001"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo / Marca *</Label>
                <Input
                  id="model"
                  placeholder="Ex: Scania R450 6x2"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fleetId">Grupo de Frota *</Label>
                <Select value={fleetId} onValueChange={(val) => setFleetId(val || '')} required>
                  <SelectTrigger id="fleetId">
                    <SelectValue placeholder="Selecione o grupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fleets.map(fleet => (
                      <SelectItem key={fleet.id} value={fleet.id}>{fleet.name}</SelectItem>
                    ))}
                    {fleets.length === 0 && (
                      <SelectItem value="empty" disabled>Nenhuma frota ativa encontrada</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || !licensePlate || !model || !fleetId}>
                  {submitting ? 'Salvando...' : 'Confirmar Cadastro'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Relação de Veículos</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input type="text" placeholder="Placa ou prefixo..." className="pl-9 h-9 text-sm bg-slate-50" disabled />
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex h-9 text-slate-600 bg-slate-50">
              Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Buscando ativos na base...
            </div>
          ) : vehicles.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <Truck className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Operação sem veículos</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-5">
                Você ainda não possui veículos cadastrados para vincular aos checklists.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar primeiro veículo
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[20%]">Placa / Prefixo</TableHead>
                  <TableHead className="w-[25%] hidden sm:table-cell">Modelo</TableHead>
                  <TableHead className="w-[20%] hidden md:table-cell">Grupo de Frota</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="text-right w-[10%]">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map(vehicle => (
                  <TableRow key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-900">{vehicle.licensePlate}</div>
                      {vehicle.prefix && <div className="text-xs text-slate-500 mt-0.5">{vehicle.prefix}</div>}
                    </TableCell>
                    <TableCell className="text-slate-600 hidden sm:table-cell">
                      {vehicle.model}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="inline-flex items-center text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <FolderOpen className="h-3 w-3 mr-1.5 text-slate-400" />
                        {vehicle.fleet?.name || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vehicle.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium">
                          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                          Regular
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 font-medium">
                          <ShieldOff className="mr-1 h-3 w-3 text-slate-400" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${vehicle.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleToggleStatus(vehicle)}
                          title={vehicle.isActive ? "Inativar" : "Reativar"}
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
    </>
  );
}
