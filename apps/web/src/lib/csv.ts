/**
 * Leitura de planilha CSV como o Excel em português salva: separador ";" (ou "," / tabulação,
 * detectado pelo cabeçalho), campos entre aspas com aspas dobradas dentro, BOM no começo e
 * quebra de linha \r\n. Devolve as linhas não vazias como listas de textos.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].reduce((best, d) => (count(firstLine, d) > count(firstLine, best) ? d : best), ';');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}

/** Cabeçalho comparável: sem acento, minúsculo e sem espaços nas pontas ("Prefixo " = "prefixo"). */
export function headerKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Arquivo CSV para baixar (BOM para o Excel abrir com acento, separador ";"). */
export function downloadCsv(fileName: string, rows: string[][]) {
  const escape = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const blob = new Blob(['﻿' + rows.map((r) => r.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
