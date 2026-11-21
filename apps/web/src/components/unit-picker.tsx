'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Unit, UnitLink } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase } from 'lucide-react';

/**
 * Frentes de trabalho que quem está logado enxerga (o administrador vê todas).
 * Com uma frente só, as telas não pedem para escolher: tudo cai nela.
 */
export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const response = await api.get<Unit[]>('/units');
      setUnits(response.data);
    } catch {
      setUnits([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const active = units.filter((unit) => unit.isActive);
  return { units, active, loaded, reload, choose: active.length > 1 };
}

/** Ids das frentes de um vínculo vindo da API. */
export function unitIdsOf(links?: UnitLink[]): string[] {
  return (links ?? []).map((link) => link.unit.id);
}

/** Nome da frente com o cliente, quando houver: "Mina Norte · Vale". */
export function unitLabel(unit: { name: string; client?: string | null }): string {
  return unit.client ? `${unit.name} · ${unit.client}` : unit.name;
}

/** Etiquetas das frentes de um registro (só as que quem está logado enxerga). */
export function UnitBadges({ links, emptyText = 'Sem frente' }: { links?: UnitLink[]; emptyText?: string }) {
  if (!links?.length) return <span className="text-xs text-amber-700">{emptyText}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {links.map((link) => (
        <Badge key={link.unit.id} variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-normal" title={unitLabel(link.unit)}>
          <Briefcase className="mr-1 h-3 w-3 text-slate-400" />
          {link.unit.name}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Escolha de várias frentes (colaborador, usuário, modelo). Com `allowAll`, mostra antes a opção
 * "Todas as frentes" (modelos de checklist).
 */
export function UnitMultiPicker({
  units,
  value,
  onChange,
  label = 'Frentes de trabalho',
  help,
  allowAll = false,
  all = false,
  onAllChange,
  idPrefix = 'unit',
}: {
  units: Unit[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  help?: string;
  allowAll?: boolean;
  all?: boolean;
  onAllChange?: (all: boolean) => void;
  idPrefix?: string;
}) {
  function toggle(id: string, checked: boolean) {
    onChange(checked ? (value.includes(id) ? value : [...value, id]) : value.filter((current) => current !== id));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-900">{label}</legend>
      {help && <p className="text-xs text-slate-500">{help}</p>}
      <div className="space-y-1.5 rounded-md border border-slate-200 p-3">
        {allowAll && (
          <label htmlFor={`${idPrefix}-all`} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium text-slate-800">
            <input
              id={`${idPrefix}-all`}
              type="checkbox"
              checked={all}
              onChange={(event) => onAllChange?.(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            Todas as frentes de trabalho
          </label>
        )}
        {units.length === 0 && <p className="text-xs text-slate-500">Nenhuma frente de trabalho cadastrada.</p>}
        {units.map((unit) => (
          <label
            key={unit.id}
            htmlFor={`${idPrefix}-${unit.id}`}
            className={`flex items-center gap-2 text-sm ${allowAll && all ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700'}`}
          >
            <input
              id={`${idPrefix}-${unit.id}`}
              type="checkbox"
              disabled={allowAll && all}
              checked={(allowAll && all) || value.includes(unit.id)}
              onChange={(event) => toggle(unit.id, event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            {unitLabel(unit)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Escolha de uma frente (frota). */
export function UnitSelect({
  units,
  value,
  onChange,
  id = 'unit-select',
  required = true,
}: {
  units: Unit[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Frente de trabalho{required ? ' *' : ''}</Label>
      <Select
        items={units.map((unit) => ({ value: unit.id, label: unitLabel(unit) }))}
        value={value}
        onValueChange={(selected) => onChange((selected as string) || '')}
        required={required}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecione a frente de trabalho" />
        </SelectTrigger>
        <SelectContent>
          {units.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>{unitLabel(unit)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
