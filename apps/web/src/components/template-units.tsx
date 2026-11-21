'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { apiErrorMessage, type Template, type Unit } from '@/lib/types';
import { UnitBadges, UnitMultiPicker, unitIdsOf } from '@/components/unit-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase } from 'lucide-react';

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
      alert(apiErrorMessage(error, 'Não foi possível salvar as frentes do modelo.'));
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
