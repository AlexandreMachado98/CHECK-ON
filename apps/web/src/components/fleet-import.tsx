'use client';

import { SheetImportDialog, type SheetImportConfig } from '@/components/sheet-import';

function fleetImport(unitNames: string[], canCreateUnits: boolean): SheetImportConfig {
  const unit = unitNames[0] || 'Nome da frente';
  return {
    endpoint: '/fleets/import',
    title: 'Importar frotas por planilha',
    description:
      'Uma linha por frota, com o nome da frota e da frente de trabalho (como está em Frentes). '
      + (canCreateUnits ? 'Frente que ainda não existe é criada junto (o cliente é opcional). ' : 'A frente precisa existir e ser sua. ')
      + 'Descrição é opcional. Depois, importe os veículos em Veículos › Importar planilha.',
    columns: {
      frota: 'fleet', nome: 'fleet', 'nome da frota': 'fleet',
      frente: 'unit', 'frente de trabalho': 'unit', contrato: 'unit',
      cliente: 'client', descricao: 'description',
    },
    required: [{ field: 'fleet', header: 'frota' }],
    template: {
      fileName: 'modelo-importacao-frotas.csv',
      rows: [
        ['frente', 'cliente', 'frota', 'descricao'],
        [unit, '', 'Caminhões basculantes', 'Transporte de minério'],
        [unit, '', 'Ônibus de turno', ''],
        ...(canCreateUnits ? [['Nova frente (exemplo)', 'Nome do cliente', 'Vans', 'Apoio administrativo']] : []),
      ],
    },
    noun: ['frota', 'frotas'],
    resultKey: { field: 'fleet', header: 'Frota' },
    previewNote: (response) => {
      const names = Array.isArray(response.newUnits) ? (response.newUnits as string[]) : [];
      return names.length ? `Frentes novas que serão criadas: ${names.join(', ')}.` : null;
    },
    doneMessage: (response) => {
      const created = Number(response.created ?? 0);
      const units = Number(response.unitsCreated ?? 0);
      return `${created} ${created === 1 ? 'frota importada' : 'frotas importadas'}${units ? ` e ${units} ${units === 1 ? 'frente criada' : 'frentes criadas'}` : ''}.`;
    },
  };
}

/** Importação de frotas (e frentes novas, para o administrador) por planilha CSV. */
export function FleetImportDialog({ open, onClose, onImported, unitNames, canCreateUnits }: { open: boolean; onClose: () => void; onImported: () => void; unitNames: string[]; canCreateUnits: boolean }) {
  return <SheetImportDialog config={fleetImport(unitNames, canCreateUnits)} open={open} onClose={onClose} onImported={onImported} />;
}
