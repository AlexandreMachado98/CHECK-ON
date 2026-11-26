'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileUp, Loader2, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { downloadCsv, headerKey, parseCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notify } from '@/components/feedback';

type Row = Record<string, string>;
/** Resultado de cada linha como a API devolve; `key` é o campo que identifica a linha (placa, nome). */
type Result = { line: number; ok: boolean; error?: string } & Record<string, unknown>;
type Checked = { rows: Row[]; results: Result[]; invalid: number; fileName: string };

export type SheetImportConfig = {
  /** Rota da API que recebe `{ rows, dryRun }`. */
  endpoint: string;
  title: string;
  description: string;
  /** Cabeçalho da planilha (sem acento e minúsculo) → campo enviado à API. */
  columns: Record<string, string>;
  /** Campos obrigatórios e o nome da coluna mostrado no erro. */
  required: { field: string; header: string }[];
  /** Modelo para baixar: nome do arquivo e linhas (a primeira é o cabeçalho). */
  template: { fileName: string; rows: string[][] };
  /** Singular e plural do que é importado ("veículo", "veículos"). */
  noun: [string, string];
  /** Campo do resultado que identifica a linha na tabela de problemas e o título da coluna. */
  resultKey: { field: string; header: string; mono?: boolean };
};

/** Lê a planilha: cabeçalho na primeira linha, colunas em qualquer ordem, colunas desconhecidas ignoradas. */
function readRows(text: string, config: SheetImportConfig): Row[] {
  const [header, ...lines] = parseCsv(text);
  if (!header) throw new Error('A planilha está vazia.');
  const fields = header.map((h) => config.columns[headerKey(h)]);
  const missing = config.required.filter((r) => !fields.includes(r.field));
  if (missing.length) {
    const quoted = missing.map((m) => `"${m.header}"`);
    const names = quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} e ${quoted[quoted.length - 1]}` : quoted[0];
    throw new Error(`A planilha precisa ${missing.length === 1 ? 'da coluna' : 'das colunas'} ${names} na primeira linha. Baixe o modelo para ver o formato.`);
  }
  return lines.map((cells) => {
    const row: Row = Object.fromEntries(config.required.map((r) => [r.field, '']));
    fields.forEach((f, i) => { if (f) row[f] = (cells[i] ?? '').trim(); });
    return row;
  });
}

/**
 * Importação por planilha CSV: baixar o modelo, escolher o arquivo, conferir a prévia (a API confere
 * tudo sem gravar) e importar. Linhas com problema ficam de fora, com o motivo.
 */
export function SheetImportDialog({ config, open, onClose, onImported }: { config: SheetImportConfig; open: boolean; onClose: () => void; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'checking' | 'importing'>('');
  const [one, many] = config.noun;
  const count = (n: number) => `${n} ${n === 1 ? one : many}`;

  function reset() {
    setChecked(null);
    setError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    reset();
    setBusy('checking');
    try {
      const rows = readRows(await file.text(), config);
      if (!rows.length) throw new Error(`A planilha não tem nenhum ${one} abaixo do cabeçalho.`);
      const res = await api.post<{ invalid: number; results: Result[] }>(config.endpoint, { rows, dryRun: true });
      setChecked({ rows, results: res.data.results, invalid: res.data.invalid, fileName: file.name });
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível ler a planilha.'));
    } finally {
      setBusy('');
    }
  }

  async function importValid() {
    if (!checked) return;
    const valid = checked.rows.filter((_, i) => checked.results[i]?.ok);
    setBusy('importing');
    setError('');
    try {
      const res = await api.post<{ created: number }>(config.endpoint, { rows: valid });
      notify(`${count(res.data.created)} ${res.data.created === 1 ? 'importado' : 'importados'}.`, 'success');
      onImported();
      close();
    } catch (err) {
      setError(apiErrorMessage(err, `Não foi possível importar os ${many}.`));
    } finally {
      setBusy('');
    }
  }

  const valid = checked ? checked.results.length - checked.invalid : 0;
  const problems = checked?.results.filter((r) => !r.ok) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            {config.description} No Excel: Arquivo › Salvar como › CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => downloadCsv(config.template.fileName, config.template.rows)}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Baixar modelo
          </Button>
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={!!busy}>
            {busy === 'checking' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" aria-hidden="true" />}
            {busy === 'checking' ? 'Conferindo...' : checked ? 'Escolher outra planilha' : 'Escolher planilha (.csv)'}
          </Button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" data-testid="import-file" onChange={(e) => choose(e.target.files?.[0])} />
        </div>

        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

        {checked && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <strong>{checked.fileName}</strong>: {checked.results.length} {checked.results.length === 1 ? 'linha' : 'linhas'}.
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> {valid} {valid === 1 ? 'pronto' : 'prontos'} para importar
              </span>
              {problems.length > 0 && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 font-medium text-amber-900">
                  <TriangleAlert className="mr-1.5 h-4 w-4" aria-hidden="true" /> {problems.length} com problema (ficam de fora)
                </span>
              )}
            </div>
            {problems.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-amber-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-amber-50 text-amber-900">
                    <tr><th className="px-3 py-1.5 font-semibold">Linha</th><th className="px-3 py-1.5 font-semibold">{config.resultKey.header}</th><th className="px-3 py-1.5 font-semibold">Problema</th></tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {problems.map((r) => (
                      <tr key={r.line}>
                        <td className="px-3 py-1.5">{r.line}</td>
                        <td className={`px-3 py-1.5 ${config.resultKey.mono ? 'font-mono' : ''}`}>{String(r[config.resultKey.field] || '—')}</td>
                        <td className="px-3 py-1.5">{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
          <Button type="button" disabled={!checked || valid === 0 || !!busy} onClick={importValid}>
            {busy === 'importing' ? 'Importando...' : `Importar ${count(valid)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
