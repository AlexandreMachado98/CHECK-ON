'use client';

import { SheetImportDialog, type SheetImportConfig } from '@/components/sheet-import';

function employeeImport(unitNames: string[]): SheetImportConfig {
  const unit = unitNames[0] || 'Nome da frente';
  const withUnits = unitNames.length > 0;
  return {
    endpoint: '/employees/import',
    title: 'Importar colaboradores por planilha',
    description: 'Uma linha por colaborador, com nome, matrícula (o login do aplicativo, não pode repetir), '
      + 'função (Motorista, Técnico, Operador ou Supervisor) e admissão em dd/mm/aaaa. Setor é opcional.'
      + (withUnits ? ' Frentes pelo nome (como está em Frentes), separadas por vírgula; sem frente, o motorista não vê veículos no app.' : '')
      + ' O acesso ao aplicativo é liberado depois, na lista.',
    columns: {
      nome: 'name', matricula: 'matricula', funcao: 'jobTitle', cargo: 'jobTitle', setor: 'department', departamento: 'department',
      admissao: 'admissionDate', 'data de admissao': 'admissionDate', frente: 'units', frentes: 'units',
    },
    required: [
      { field: 'name', header: 'nome' },
      { field: 'matricula', header: 'matricula' },
      { field: 'jobTitle', header: 'funcao' },
      { field: 'admissionDate', header: 'admissao' },
    ],
    template: {
      fileName: 'modelo-importacao-colaboradores.csv',
      rows: [
        ['nome', 'matricula', 'funcao', 'setor', 'admissao', ...(withUnits ? ['frentes'] : [])],
        ['Maria da Silva', '1001', 'Motorista', 'Operação', '15/03/2024', ...(withUnits ? [unit] : [])],
        ['João Pereira', '1002', 'Técnico', 'Manutenção', '02/01/2023', ...(withUnits ? [unitNames.slice(0, 2).join(', ') || unit] : [])],
      ],
    },
    noun: ['colaborador', 'colaboradores'],
    resultKey: { field: 'name', header: 'Nome' },
  };
}

/** Importação de colaboradores por planilha CSV (nome, matrícula, função e admissão; frentes pelo nome). */
export function EmployeeImportDialog({ open, onClose, onImported, unitNames }: { open: boolean; onClose: () => void; onImported: () => void; unitNames: string[] }) {
  return <SheetImportDialog config={employeeImport(unitNames)} open={open} onClose={onClose} onImported={onImported} />;
}
