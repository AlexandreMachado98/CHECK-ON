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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName]             = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    try {
      setLoading(true); setError('');
      const res = await api.get<Template[]>('/templates');
      setTemplates(res.data);
    } catch {
      setError('Não foi possível carregar os templates.');
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
      setName(''); setDescription('');
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

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Checklist</h1>
          <p className="text-muted-foreground mt-1">
            Crie modelos reutilizáveis para inspeções e checklists operacionais
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button>Novo Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Template</DialogTitle>
              <DialogDescription>
                Defina o nome e a descrição. Depois, você poderá adicionar categorias e itens.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nome do Template *</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ex: Inspeção Diária de Veículo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Descrição</Label>
                <Input
                  id="tpl-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva quando este checklist deve ser usado"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving || !name}>
                  {saving ? 'Criando...' : 'Criar e Configurar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mt-2">
        <CardHeader><CardTitle>Templates Disponíveis</CardTitle></CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">{error}</div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categorias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Nenhum template criado. Clique em &quot;Novo Template&quot; para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map(tpl => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {tpl.description ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tpl._count?.categories ?? tpl.categories?.length ?? 0} categoria(s)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={tpl.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                          {tpl.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link href={`/dashboard/templates/${tpl.id}`}>
                          <Button variant="outline" size="sm">Editar Estrutura</Button>
                        </Link>
                        <Button
                          variant="ghost" size="sm"
                          className={tpl.isActive
                            ? 'text-destructive hover:text-destructive'
                            : 'text-green-600 hover:text-green-600'}
                          onClick={() => handleToggle(tpl)}
                        >
                          {tpl.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
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
