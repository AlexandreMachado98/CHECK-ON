'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { apiErrorMessage, type Template, type Unit } from '@/lib/types';
import { UnitBadges, UnitMultiPicker, unitIdsOf } from '@/components/unit-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase } from 'lucide-react';
import { notify } from '@/components/feedback';

/** Onde o modelo vale: "Todas as frentes" ou as frentes dele. */
export function TemplateUnitsLabel({ template }: { template: Pick<Template, 'allUnits' | 'units'> }) {
  if (template.allUnits !== false) {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
        <Briefcase className="mr-1 h-3 w-3" /> Todas as frentes
      </Badge>
    );
  }
  return <UnitBadges links={template.units} emptyText="Sem frente: não aparece no app" />;
}

/**
 * Janela para escolher onde o modelo vale. Só o administrador marca "todas as frentes";
 * quem é limitado escolhe entre as frentes dele.
 */
export function TemplateUnitsDialog({
  template,
  units,
  allowAll,
  open,
  onClose,
  onSaved,
}: {
  template: Template;
  units: Unit[];
  allowAll: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [all, setAll] = useState(template.allUnits !== false);
  const [unitIds, setUnitIds] = useState<string[]>(unitIdsOf(template.units));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/templates/${template.id}`, allowAll && all ? { allUnits: true } : { allUnits: false, unitIds });
      onSaved();
      onClose();
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível salvar as frentes do modelo.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Frentes de trabalho do modelo</DialogTitle>
          <DialogDescription>
            O checklist só aparece no aplicativo para os veículos das frentes marcadas.
          </DialogDescription>
        </DialogHeader>
        <UnitMultiPicker
          idPrefix="template-unit"
          units={units}
          value={unitIds}
          onChange={setUnitIds}
          allowAll={allowAll}
          all={all}
          onAllChange={setAll}
          label="Vale para"
        />
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={saving || (!(allowAll && all) && unitIds.length === 0)} onClick={save}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Copiar o modelo para outra(s) frente(s): cria um modelo novo e independente, como rascunho.
 * O original não muda. Quem é limitado escolhe entre as frentes dele.
 */
export function CopyTemplateDialog({
  template,
  units,
  allowAll,
  onClose,
  onCopied,
}: {
  template: Template;
  units: Unit[];
  allowAll: boolean;
  onClose: () => void;
  onCopied: (copy: Template) => void;
}) {
  const [name, setName] = useState(`${template.name} (cópia)`);
  const [all, setAll] = useState(false);
  // Empresa com uma frente só: ela já vem marcada.
  const [unitIds, setUnitIds] = useState<string[]>(units.length === 1 ? [units[0].id] : []);
  const [saving, setSaving] = useState(false);
  const pickUnits = units.length > 0;
  const valid = name.trim().length > 0 && (!pickUnits || (allowAll && all) || unitIds.length > 0);

  async function copy() {
    setSaving(true);
    try {
      const body = !pickUnits ? { name: name.trim() } : allowAll && all ? { name: name.trim(), allUnits: true } : { name: name.trim(), unitIds };
      const response = await api.post<Template>(`/templates/${template.id}/copy`, body);
      onCopied(response.data);
    } catch (error) {
      notify(apiErrorMessage(error, 'Não foi possível copiar o modelo.'));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar modelo</DialogTitle>
          <DialogDescription>
            Cria um modelo novo, com as mesmas seções e itens de &quot;{template.name}&quot;. A cópia é independente: mudar uma não
            altera a outra. Ela nasce como rascunho, para você revisar antes de ativar no aplicativo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="copy-name" className="text-sm font-medium text-slate-900">Nome da cópia *</label>
            <input
              id="copy-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
            />
          </div>
          {pickUnits && (
            <UnitMultiPicker
              idPrefix="copy-unit"
              units={units}
              value={unitIds}
              onChange={setUnitIds}
              allowAll={allowAll}
              all={all}
              onAllChange={setAll}
              label="Copiar para"
              help="A cópia só aparece no aplicativo para os veículos das frentes marcadas."
            />
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={saving || !valid} onClick={copy}>{saving ? 'Copiando...' : 'Copiar e abrir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
