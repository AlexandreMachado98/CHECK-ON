'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Template, TemplateCategory, TemplateItem, ItemType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ITEM_TYPES: { value: ItemType; label: string; description: string }[] = [
  { value: 'PASS_FAIL', label: 'Conforme / Não Conforme', description: 'O inspetor marca OK ou NC' },
  { value: 'TEXT',      label: 'Texto Livre',             description: 'Campo aberto para observações' },
  { value: 'NUMBER',    label: 'Valor Numérico',          description: 'Ex: leitura de odômetro ou pressão' },
  { value: 'PHOTO',     label: 'Foto Obrigatória',        description: 'Motorista precisa tirar uma foto' },
];

const TYPE_COLORS: Record<ItemType, string> = {
  PASS_FAIL: 'bg-blue-100 text-blue-700',
  TEXT:      'bg-yellow-100 text-yellow-700',
  NUMBER:    'bg-purple-100 text-purple-700',
  PHOTO:     'bg-orange-100 text-orange-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Item Dialog
// ─────────────────────────────────────────────────────────────────────────────
interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { text: string; type: ItemType; isRequired: boolean }) => Promise<void>;
  initial?: Partial<{ text: string; type: ItemType; isRequired: boolean }>;
  title: string;
}

function ItemDialog({ open, onClose, onSave, initial, title }: ItemDialogProps) {
  const [text, setText]           = useState(initial?.text ?? '');
  const [type, setType]           = useState<ItemType>(initial?.type ?? 'PASS_FAIL');
  const [isRequired, setRequired] = useState(initial?.isRequired ?? true);
  const [saving, setSaving]       = useState(false);

  // Reset when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setText(initial?.text ?? '');
      setType(initial?.type ?? 'PASS_FAIL');
      setRequired(initial?.isRequired ?? true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await onSave({ text, type, isRequired });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure a pergunta/item do checklist.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Texto da Pergunta / Item *</Label>
            <Input
              value={text}
              onChange={e => setText(e.target.value)}
              required
              placeholder="Ex: Verificar nível do óleo"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Resposta *</Label>
            <Select value={type} onValueChange={v => setType((v || 'PASS_FAIL') as ItemType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <p className="font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="required-check"
              checked={isRequired}
              onChange={e => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="required-check" className="cursor-pointer">
              Item obrigatório <span className="text-muted-foreground text-xs">(bloqueia conclusão se não respondido)</span>
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !text}>
              {saving ? 'Salvando...' : 'Salvar Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category block
// ─────────────────────────────────────────────────────────────────────────────
interface CategoryBlockProps {
  category: TemplateCategory;
  onAddItem: (categoryId: string, data: { text: string; type: ItemType; isRequired: boolean }) => Promise<void>;
  onUpdateItem: (itemId: string, data: { text: string; type: ItemType; isRequired: boolean }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onRenameCategory: (categoryId: string, name: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

function CategoryBlock({
  category, onAddItem, onUpdateItem, onDeleteItem, onRenameCategory, onDeleteCategory,
}: CategoryBlockProps) {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName]         = useState(category.name);
  const [savingName, setSavingName]   = useState(false);

  const [addItemOpen, setAddItemOpen]       = useState(false);
  const [editItem, setEditItem]             = useState<TemplateItem | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setSavingName(true);
      await onRenameCategory(category.id, newName.trim());
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          {editingName ? (
            <form onSubmit={handleRename} className="flex gap-2 flex-1">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" type="submit" disabled={savingName}>
                {savingName ? '...' : 'OK'}
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setEditingName(false)}>
                ✕
              </Button>
            </form>
          ) : (
            <CardTitle className="text-base">{category.name}</CardTitle>
          )}

          <div className="flex gap-1 shrink-0">
            {!editingName && (
              <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
                Renomear
              </Button>
            )}
            <Button
              size="sm" variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDeleteCategory(category.id)}
            >
              Remover Seção
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {category.items.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-1">
            Nenhum item nesta seção.
          </p>
        )}

        {category.items.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 p-3 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-xs text-muted-foreground mt-0.5 min-w-[1.5rem] text-right">
                {idx + 1}.
              </span>
              <div>
                <p className="text-sm font-medium">{item.text}</p>
                <div className="flex gap-2 mt-1">
                  <Badge className={`text-xs ${TYPE_COLORS[item.type]}`}>
                    {ITEM_TYPES.find(t => t.value === item.type)?.label}
                  </Badge>
                  {item.isRequired && (
                    <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm" variant="ghost"
                onClick={() => setEditItem(item)}
              >
                Editar
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onDeleteItem(item.id)}
              >
                ✕
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 border-dashed border-2 border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50"
          onClick={() => setAddItemOpen(true)}
        >
          + Adicionar Item à Seção
        </Button>

        {/* Add item dialog */}
        <ItemDialog
          open={addItemOpen}
          onClose={() => setAddItemOpen(false)}
          title={`Novo Item em "${category.name}"`}
          onSave={data => onAddItem(category.id, data)}
        />

        {/* Edit item dialog */}
        {editItem && (
          <ItemDialog
            open={!!editItem}
            onClose={() => setEditItem(null)}
            title="Editar Item"
            initial={{ text: editItem.text, type: editItem.type, isRequired: editItem.isRequired }}
            onSave={data => onUpdateItem(editItem.id, data)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Template Builder page
// ─────────────────────────────────────────────────────────────────────────────
export default function TemplateBuilderPage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = params.id as string;

  const [template, setTemplate]       = useState<Template | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // new category
  const [newCatName, setNewCatName]   = useState('');
  const [addingCat, setAddingCat]     = useState(false);

  const fetchTemplate = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const res = await api.get<Template>(`/templates/${id}`);
      setTemplate(res.data);
    } catch {
      setError('Template não encontrado ou acesso negado.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  // ── Category actions ───────────────────────────────────────────────────────

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      setAddingCat(true);
      await api.post(`/templates/${id}/categories`, { name: newCatName.trim() });
      setNewCatName('');
      fetchTemplate();
    } catch {
      alert('Erro ao adicionar seção.');
    } finally {
      setAddingCat(false);
    }
  }

  async function handleRenameCategory(categoryId: string, name: string) {
    await api.patch(`/templates/categories/${categoryId}`, { name });
    fetchTemplate();
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Remover esta seção e todos os seus itens?')) return;
    await api.delete(`/templates/categories/${categoryId}`);
    fetchTemplate();
  }

  // ── Item actions ───────────────────────────────────────────────────────────

  async function handleAddItem(
    categoryId: string,
    data: { text: string; type: ItemType; isRequired: boolean },
  ) {
    await api.post(`/templates/categories/${categoryId}/items`, data);
    fetchTemplate();
  }

  async function handleUpdateItem(
    itemId: string,
    data: { text: string; type: ItemType; isRequired: boolean },
  ) {
    await api.patch(`/templates/items/${itemId}`, data);
    fetchTemplate();
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Remover este item?')) return;
    await api.delete(`/templates/items/${itemId}`);
    fetchTemplate();
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Carregando template...</p>;
  }

  if (error || !template) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-destructive">{error || 'Template não encontrado.'}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/templates')}>Voltar</Button>
      </div>
    );
  }

  const totalItems = template.categories.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => router.push('/dashboard/templates')}>
            ← Voltar para Templates
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
          {template.description && (
            <p className="text-muted-foreground mt-1">{template.description}</p>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{template.categories.length} seção(ões)</Badge>
            <Badge variant="outline">{totalItems} item(ns)</Badge>
            <Badge className={template.isActive
              ? 'bg-green-100 text-green-700 hover:bg-green-100'
              : 'bg-red-100 text-red-700 hover:bg-red-100'}>
              {template.isActive ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Add category */}
      <form onSubmit={handleAddCategory} className="flex gap-2 mt-2">
        <Input
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          placeholder="Nome da nova seção  (ex: Motor, Pneus, Iluminação)"
          className="max-w-lg"
        />
        <Button type="submit" disabled={addingCat || !newCatName.trim()}>
          {addingCat ? 'Adicionando...' : '+ Adicionar Seção'}
        </Button>
      </form>

      {/* Categories */}
      {template.categories.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-1">Template vazio</p>
            <p className="text-sm">Adicione seções acima para começar a montar o checklist.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mt-4">
          {template.categories.map(cat => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          ))}
        </div>
      )}
    </>
  );
}
