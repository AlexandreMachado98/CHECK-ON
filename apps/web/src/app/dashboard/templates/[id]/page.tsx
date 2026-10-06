'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Template, TemplateCategory, TemplateItem, ItemType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2, Plus, GripVertical, CheckCircle2, Type, Hash, Camera, LayoutList, Settings2, Edit2, Activity } from 'lucide-react';

const ITEM_TYPES: { value: ItemType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'PASS_FAIL', label: 'Conformidade (OK / NC)', description: 'O inspetor avalia a condição do item.', icon: CheckCircle2 },
  { value: 'TEXT',      label: 'Texto Livre',             description: 'Campo aberto para anotações.', icon: Type },
  { value: 'NUMBER',    label: 'Valor Numérico',          description: 'Registro de quilometragem, pressão, etc.', icon: Hash },
  { value: 'PHOTO',     label: 'Foto Obrigatória',        description: 'Exige o envio de uma evidência visual.', icon: Camera },
];

interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { text: string; type: ItemType; isRequired: boolean }) => Promise<void>;
  initial?: Partial<{ text: string; type: ItemType; isRequired: boolean }>;
  title: string;
}

function ItemDialog({ open, onClose, onSave, initial, title }: ItemDialogProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [type, setType] = useState<ItemType>(initial?.type ?? 'PASS_FAIL');
  const [isRequired, setRequired] = useState(initial?.isRequired ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setText(initial?.text ?? '');
      setType(initial?.type ?? 'PASS_FAIL');
      setRequired(initial?.isRequired ?? true);
    }
  }, [open, initial]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure a regra de inspeção para este item.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Descrição da Inspeção *</Label>
            <Input value={text} onChange={e => setText(e.target.value)} required placeholder="Ex: Verificar calibragem do pneu dianteiro direito" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Resposta Esperada *</Label>
            <Select value={type} onValueChange={v => setType((v || 'PASS_FAIL') as ItemType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center">
                        <Icon className="h-4 w-4 mr-2 text-slate-500" />
                        <span>{t.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-2 pb-2">
            <input 
              type="checkbox" 
              id="req" 
              checked={isRequired} 
              onChange={e => setRequired(e.target.checked)} 
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" 
            />
            <Label htmlFor="req" className="font-normal text-slate-700 cursor-pointer">Resposta obrigatória para finalizar o checklist</Label>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !text}>
              {saving ? 'Processando...' : 'Salvar Regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CategoryBlockProps {
  category: TemplateCategory;
  onAddItem: (catId: string, data: { text: string; type: ItemType; isRequired: boolean }) => Promise<void>;
  onUpdateItem: (itemId: string, data: { text: string; type: ItemType; isRequired: boolean }) => Promise<void>;
  onDeleteItem: (itemId: string) => void;
  onRenameCategory: (catId: string, newName: string) => void;
  onDeleteCategory: (catId: string) => void;
}

function CategoryBlock({ category, onAddItem, onUpdateItem, onDeleteItem, onRenameCategory, onDeleteCategory }: CategoryBlockProps) {
  const [isEditingCat, setIsEditingCat] = useState(false);
  const [catName, setCatName] = useState(category.name);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<TemplateItem | null>(null);

  function handleSaveCatName() {
    if (catName.trim() && catName !== category.name) {
      onRenameCategory(category.id, catName.trim());
    }
    setIsEditingCat(false);
  }

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden" id={`cat-${category.id}`}>
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between group">
        <div className="flex-1 flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-300 cursor-grab active:cursor-grabbing" />
          {isEditingCat ? (
            <div className="flex items-center gap-2 max-w-sm w-full">
              <Input autoFocus value={catName} onChange={e => setCatName(e.target.value)} onBlur={handleSaveCatName} onKeyDown={e => e.key === 'Enter' && handleSaveCatName()} className="h-8 text-sm font-semibold" />
            </div>
          ) : (
            <h3 className="font-semibold text-slate-800 text-sm">{category.name}</h3>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => setIsEditingCat(true)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => onDeleteCategory(category.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      <CardContent className="p-0">
        {category.items.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            Nenhuma regra configurada nesta seção.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {category.items.map(item => {
              const typeConfig = ITEM_TYPES.find(t => t.value === item.type);
              const Icon = typeConfig?.icon || LayoutList;
              return (
                <div key={item.id} className="flex items-center p-3 hover:bg-slate-50/50 transition-colors group">
                  <GripVertical className="h-4 w-4 text-slate-300 mr-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 flex items-center">
                      {item.isRequired && <span className="text-rose-500 mr-1" title="Obrigatório">*</span>}
                      {item.text}
                    </p>
                    <div className="flex items-center mt-1">
                      <Icon className="h-3 w-3 text-slate-400 mr-1" />
                      <span className="text-xs text-slate-500">{typeConfig?.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={() => setEditItem(item)}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => onDeleteItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="p-3 bg-slate-50/30 border-t border-slate-100">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs border-dashed text-slate-500 hover:text-slate-800 hover:border-slate-400 bg-transparent" onClick={() => setAddItemOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra de inspeção
          </Button>
        </div>

        <ItemDialog open={addItemOpen} onClose={() => setAddItemOpen(false)} title={`Nova Regra em "${category.name}"`} onSave={data => onAddItem(category.id, data)} />
        {editItem && (
          <ItemDialog open={!!editItem} onClose={() => setEditItem(null)} title="Configurar Regra" initial={{ text: editItem.text, type: editItem.type, isRequired: editItem.isRequired }} onSave={data => onUpdateItem(editItem.id, data)} />
        )}
      </CardContent>
    </Card>
  );
}

export default function TemplateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const fetchTemplate = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const res = await api.get<Template>(`/templates/${id}`);
      setTemplate(res.data);
    } catch {
      setError('Modelo não encontrado ou acesso negado.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

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
    if (!confirm('Remover esta seção e todas as suas regras?')) return;
    await api.delete(`/templates/categories/${categoryId}`);
    fetchTemplate();
  }

  async function handleAddItem(categoryId: string, data: { text: string; type: ItemType; isRequired: boolean }) {
    await api.post(`/templates/categories/${categoryId}/items`, data);
    fetchTemplate();
  }

  async function handleUpdateItem(itemId: string, data: { text: string; type: ItemType; isRequired: boolean }) {
    await api.patch(`/templates/items/${itemId}`, data);
    fetchTemplate();
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Remover esta regra?')) return;
    await api.delete(`/templates/items/${itemId}`);
    fetchTemplate();
  }

  function scrollToCat(catId: string) {
    document.getElementById(`cat-${catId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) return <div className="py-20 flex justify-center"><Activity className="h-6 w-6 animate-pulse text-slate-400" /></div>;
  if (error || !template) return <div className="text-center py-10 space-y-4"><p className="text-rose-600">{error || 'Modelo não encontrado.'}</p><Button variant="outline" onClick={() => router.push('/dashboard/templates')}>Voltar</Button></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header Panel */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 mb-6 rounded-t-xl border-x border-t shadow-sm">
        <div>
          <button className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-1 transition-colors" onClick={() => router.push('/dashboard/templates')}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Voltar para modelos
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{template.name}</h1>
            <Badge variant="outline" className={template.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'}>
              {template.isActive ? 'Operacional' : 'Rascunho'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">{template.description || 'Sem descrição'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="shadow-sm text-xs"
            onClick={async () => {
              await api.patch(`/templates/${template.id}`, { isActive: !template.isActive });
              fetchTemplate();
            }}
          >
            {template.isActive ? 'Desativar Modelo' : 'Ativar Modelo'}
          </Button>
        </div>
      </div>

      {/* Builder 2-Column Area */}
      <div className="flex flex-1 gap-6 min-h-0">
        
        {/* Left Sidebar (Structure) */}
        <div className="w-72 shrink-0 flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center">
              <LayoutList className="h-4 w-4 mr-2 text-slate-500" />
              Estrutura do Formulário
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {template.categories.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Nenhuma seção criada.</p>
            ) : (
              <ul className="space-y-1">
                {template.categories.map((c, i) => (
                  <li key={c.id}>
                    <button onClick={() => scrollToCat(c.id)} className="w-full text-left px-3 py-2 text-sm text-slate-700 font-medium hover:bg-slate-100 rounded-md transition-colors flex items-center justify-between group">
                      <span className="truncate mr-2">{i + 1}. {c.name}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{c.items.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t bg-slate-50">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nova seção..." className="h-8 text-xs" />
              <Button type="submit" size="sm" className="h-8 px-2 shrink-0" disabled={addingCat || !newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Right Content (Editor) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-2">
          {template.categories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <LayoutList className="h-12 w-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600 mb-2">Construa seu checklist</p>
              <p className="text-sm max-w-sm text-center">Use o painel lateral esquerdo para criar sua primeira seção estrutural.</p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-6">
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
        </div>
      </div>
    </div>
  );
}
