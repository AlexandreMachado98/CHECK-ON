'use client';

import { SheetImportDialog, type SheetImportConfig } from '@/components/sheet-import';

function vehicleImport(exampleFleet?: string): SheetImportConfig {
  const fleet = exampleFleet || 'Nome da frota';
  return {
    endpoint: '/vehicles/import',
    title: 'Importar veículos por planilha',
    description: 'Uma linha por veículo, com placa e o nome da frota (como está em Frotas). Prefixo, marca, modelo e ano são opcionais.',
    columns: { placa: 'plate', frota: 'fleet', prefixo: 'prefix', codigo: 'prefix', marca: 'brand', modelo: 'model', ano: 'year' },
    required: [{ field: 'plate', header: 'placa' }, { field: 'fleet', header: 'frota' }],
    template: {
      fileName: 'modelo-importacao-veiculos.csv',
      rows: [
        ['placa', 'frota', 'prefixo', 'marca', 'modelo', 'ano'],
        ['ABC1D23', fleet, 'P-101', 'Volvo', 'FH 540', '2022'],
        ['DEF4567', fleet, '', 'Scania', 'R 450', ''],
      ],
    },
    noun: ['veículo', 'veículos'],
    resultKey: { field: 'plate', header: 'Placa', mono: true },
  };
}

/** Importação de veículos por planilha CSV (placa e frota obrigatórias). */
export function VehicleImportDialog({ open, onClose, onImported, exampleFleet }: { open: boolean; onClose: () => void; onImported: () => void; exampleFleet?: string }) {
  return <SheetImportDialog config={vehicleImport(exampleFleet)} open={open} onClose={onClose} onImported={onImported} />;
}
