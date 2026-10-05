'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Fleet, Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');
  const [fleetId, setFleetId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicles();
    fetchFleets();
  }, []);

  async function fetchVehicles() {
    try {
      setLoading(true);
      const res = await api.get('/vehicles');
      setVehicles(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFleets() {
    try {
      const res = await api.get('/fleets');
      setFleets(res.data);
    } catch (err) {
      console.error('Erro ao buscar frotas', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/vehicles', { 
        plate, 
        model, 
        brand, 
        year: parseInt(year, 10), 
        fleetId 
      });
      setIsDialogOpen(false);
      setPlate('');
      setModel('');
      setBrand('');
      setYear('');
      setFleetId('');
      fetchVehicles();
    } catch (err) {
      console.error('Erro ao criar veículo', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Veículos</h1>
          <p className="text-muted-foreground mt-1">Gerencie a frota de veículos</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger >
            <Button>Novo Veículo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Veículo</DialogTitle>
              <DialogDescription>
                Insira as informações do novo veículo.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plate">Placa</Label>
                  <Input id="plate" value={plate} onChange={e => setPlate(e.target.value)} required placeholder="ABC-1234" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Input id="year" type="number" value={year} onChange={e => setYear(e.target.value)} required placeholder="2024" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Marca</Label>
                  <Input id="brand" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="Ex: Ford" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input id="model" value={model} onChange={e => setModel(e.target.value)} required placeholder="Ex: Ranger" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fleet">Vincular a uma Frota</Label>
                <Select value={fleetId} onValueChange={(val) => setFleetId(val || '')} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma frota" />
                  </SelectTrigger>
                  <SelectContent>
                    {fleets.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting || !fleetId}>{submitting ? 'Salvando...' : 'Salvar Veículo'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Listagem de Veículos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Marca/Modelo</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum veículo encontrado.</TableCell>
                  </TableRow>
                ) : (
                  vehicles.map(vehicle => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium uppercase">{vehicle.plate}</TableCell>
                      <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                      <TableCell>{vehicle.year}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${vehicle.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {vehicle.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
