'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { Template } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClipboardCheck, Plus, Search, Edit2, Archive, Activity, LayoutList } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const res = await api.get<Template[]>('/templates');
      setTemplates(res.data);
    } catch {
      console.error('Falha ao carregar templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/templates', { name, description });
      setCreateOpen(false);
      setName(''); 
      setDescription('');
      fetchTemplates();
    } catch {
      alert('Erro ao criar template.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(tpl: Template) {
    try {
      await api.patch(`/templates/${tpl.id}`, { isActive: !tpl.isActive });
      fetchTemplates();
    } catch {
      alert('Erro ao alterar status.');
    }
  }

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Modelos de Checklist</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure os formulários e inspeções que serão respondidos em campo.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button className="shrink-0 shadow-sm" size="default">
              <Plus className="mr-2 h-4 w-4" />
              Criar Modelo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Modelo de Checklist</DialogTitle>
              <DialogDescription>
                Defina o objetivo principal desta inspeção antes de adicionar as perguntas.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nome do Modelo *</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ex: Inspeção Diária de Frota (Check-list)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Descrição / Instruções</Label>
                <Input
                  id="tpl-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Obrigatório antes de iniciar a rota..."
                />
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving || !name}>
                  {saving ? 'Criando...' : 'Iniciar Construção'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Modelos Cadastrados</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Buscar modelo..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50" 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <Activity className="h-6 w-6 animate-pulse text-slate-300 mb-2" />
              Buscando modelos...
            </div>
          ) : templates.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center bg-slate-50/30">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <ClipboardCheck className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum modelo criado</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-5">
                Você ainda não possui checklists configurados. Crie seu primeiro modelo de inspeção.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Criar modelo
              </Button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 text-sm">
              Nenhum modelo encontrado para a busca &quot;{search}&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[35%]">Título do Modelo</TableHead>
                  <TableHead className="w-[30%] hidden sm:table-cell">Descrição</TableHead>
                  <TableHead className="w-[15%]">Situação</TableHead>
                  <TableHead className="text-right w-[20%]">Configuração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((tpl) => (
                  <TableRow key={tpl.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-900 flex items-center">
                        <LayoutList className="h-4 w-4 text-slate-400 mr-2" />
                        {tpl.name}
                      </div>
                      {/* {tpl.categories?.length > 0 && <div className="text-xs text-slate-500 mt-1">{tpl.categories.length} sessões configuradas</div>} */}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm hidden sm:table-cell">
                      {tpl.description || '—'}
                    </TableCell>
                    <TableCell>
                      {tpl.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium shadow-sm">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full inline-block bg-emerald-500"></span>
                          Operacional
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 font-medium shadow-sm">
                          Rascunho
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/templates/${tpl.id}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs font-medium text-slate-700 bg-white">
                            <Edit2 className="h-3.5 w-3.5 mr-2 text-primary" />
                            Construtor
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${tpl.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleToggle(tpl)}
                          title={tpl.isActive ? "Arquivar modelo" : "Ativar modelo"}
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
