// ─── Relatório gerencial: período, comparação e exportação (PDF e planilha) ─────────────────
//
// Os números vêm prontos da API (GET /dashboard/report e /dashboard/report/vehicles), já
// filtrados pela empresa e pelas frentes de trabalho de quem está logado. Aqui só se formata.

import { formatDateTime } from './checklist-pdf';

export type PeriodKey = '7d' | '30d' | '90d' | '12m' | 'all' | 'custom';

export interface ReportTotals {
  inspections: { total: number; completed: number; withNc: number; compliant: number };
  complianceRate: number | null;
  ncs: { total: number; active: number };
}

export interface Report extends ReportTotals {
  period: { key: PeriodKey; from: string | null; to: string | null };
  unit: { id: string; name: string; client?: string | null } | null;
  ncs: ReportTotals['ncs'] & { bySeverity: Record<string, number> };
  topVehicles: { vehicleId: string; plate: string; count: number }[];
  previous: (ReportTotals & { from: string; to: string }) | null;
}

export interface VehicleReportRow {
  plate: string;
  prefix: string | null;
  model: string | null;
  fleet: string;
  unit: string | null;
  status: string;
  inspections: number;
  completed: number;
  withNc: number;
  complianceRate: number | null;
  ncsOpened: number;
  activeNcs: number;
  lastInspection: string | null;
}

export interface ReportContext {
  companyName?: string | null;
  generatedBy?: string | null;
}

const TIME_ZONE = 'America/Sao_Paulo';
const PRESET_LABEL: Record<string, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '12m': '12 meses' };
const STATUS_LABEL: Record<string, string> = { LIBERADO: 'Liberado', ATENCAO: 'Atenção', BLOQUEADO: 'Bloqueado' };

/** "25/10/2026" no horário da empresa. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
}

/** Último dia do intervalo: o fim vem exclusivo (meia-noite do dia seguinte). */
function lastDay(toExclusive: string): string {
  return formatDay(new Date(new Date(toExclusive).getTime() - 1).toISOString());
}

/** "últimos 30 dias (desde 25/10/2026)" / "01/10/2026 a 31/10/2026" / "todo o histórico". */
export function describePeriod(period: Report['period']): string {
  if (period.key === 'all' || !period.from) return 'todo o histórico';
  if (period.key === 'custom' && period.to) {
    const first = formatDay(period.from);
    const last = lastDay(period.to);
    return first === last ? first : `${first} a ${last}`;
  }
  return `últimos ${PRESET_LABEL[period.key] ?? period.key} (desde ${formatDay(period.from)})`;
}

/** "01/09/2026 a 30/09/2026": o período anterior, para a legenda da comparação. */
export function describePrevious(previous: { from: string; to: string }): string {
  return `${formatDay(previous.from)} a ${lastDay(previous.to)}`;
}

export interface Delta {
  /** "+12%", "−5 p.p.", "=" */
  text: string;
  /** Melhorou, piorou ou ficou igual (para a cor). */
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * Variação em relação ao período anterior. `higherIsBetter`: conformidade sobe = bom; NCs sobem = ruim.
 * Conformidade em pontos percentuais; contagens em %. Sem base de comparação: null.
 */
export function delta(current: number | null, previous: number | null | undefined, kind: 'count' | 'points', higherIsBetter: boolean): Delta | null {
  if (current == null || previous == null) return null;
  const diff = kind === 'points' ? current - previous : previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  if (diff == null) return null;
  if (diff === 0) return { text: '=', tone: 'neutral' };
  const sign = diff > 0 ? '+' : '−';
  const text = `${sign}${Math.abs(diff)}${kind === 'points' ? ' p.p.' : '%'}`;
  return { text, tone: diff > 0 === higherIsBetter ? 'good' : 'bad' };
}

/** Nome do arquivo: relatorio-checkon-2026-10-01-a-2026-10-31-mina-norte. */
export function reportFileName(report: Report, extension: string): string {
  const day = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });
  const period = !report.period.from
    ? 'historico'
    : `${day(report.period.from)}-a-${day(report.period.to ? new Date(new Date(report.period.to).getTime() - 1).toISOString() : new Date().toISOString())}`;
  const unit = report.unit ? `-${report.unit.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
  return `relatorio-checkon-${period}${unit}.${extension}`;
}

function percent(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

/** Linhas da planilha/tabela por veículo, no mesmo formato nos dois arquivos. */
export const VEHICLE_COLUMNS = [
  'Placa', 'Prefixo', 'Modelo', 'Frota', 'Frente', 'Situação', 'Inspeções', 'Com NC', 'Conformidade', 'NCs abertas no período', 'NCs ativas hoje', 'Última inspeção',
];

export function vehicleCells(row: VehicleReportRow): string[] {
  return [
    row.plate,
    row.prefix ?? '',
    row.model ?? '',
    row.fleet,
    row.unit ?? '',
    STATUS_LABEL[row.status] ?? row.status,
    String(row.inspections),
    String(row.withNc),
    percent(row.complianceRate),
    String(row.ncsOpened),
    String(row.activeNcs),
    row.lastInspection ? formatDateTime(row.lastInspection) : 'Sem inspeção no período',
  ];
}

/** Planilha (CSV) que o Excel abre direto em português: ";" entre colunas e acentos preservados. */
export function reportCsv(report: Report, rows: VehicleReportRow[], context: ReportContext = {}): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const line = (values: (string | number)[]) => values.map(cell).join(';');
  const header = [
    line(['Relatório de inspeções', context.companyName ?? '']),
    line(['Período', describePeriod(report.period)]),
    line(['Frente de trabalho', report.unit ? report.unit.name : 'Todas as frentes']),
    line(['Inspeções', report.inspections.total]),
    line(['Conformidade', percent(report.complianceRate)]),
    line(['Não conformidades abertas no período', report.ncs.total]),
    ...(report.previous
      ? [line(['Período anterior', describePrevious(report.previous)]), line(['Inspeções no anterior', report.previous.inspections.total]), line(['Conformidade no anterior', percent(report.previous.complianceRate)])]
      : []),
    line(['Gerado em', `${formatDateTime(new Date().toISOString())}${context.generatedBy ? ` por ${context.generatedBy}` : ''}`]),
    '',
  ];
  // BOM: sem ele o Excel abre os acentos errados.
  return '﻿' + [...header, line(VEHICLE_COLUMNS), ...rows.map((row) => line(vehicleCells(row)))].join('\r\n') + '\r\n';
}

function saveFile(content: BlobPart, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReportCsv(report: Report, rows: VehicleReportRow[], context: ReportContext = {}) {
  saveFile(reportCsv(report, rows, context), 'text/csv;charset=utf-8', reportFileName(report, 'csv'));
}

const BRAND: [number, number, number] = [5, 150, 105];
const TEXT: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const MARGIN = 14;

/** PDF do relatório: resumo, comparação, gravidade das NCs e a tabela por veículo. */
export async function downloadReportPdf(report: Report, rows: VehicleReportRow[], context: ReportContext = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de inspeções', MARGIN, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subtitle = [context.companyName, report.unit ? `Frente: ${report.unit.name}` : 'Todas as frentes', describePeriod(report.period)].filter(Boolean).join(' · ');
  doc.text(subtitle, MARGIN, 17);

  const prev = report.previous;
  const compare = (current: number | null, previous: number | null | undefined, kind: 'count' | 'points', higherIsBetter: boolean) =>
    // A fonte padrão do PDF não tem o sinal de menos tipográfico (−): vai o hífen comum.
    delta(current, previous, kind, higherIsBetter)?.text.replace('−', '-') ?? '-';
  autoTable(doc, {
    startY: 28,
    head: [['', 'No período', ...(prev ? [`Anterior (${describePrevious(prev)})`, 'Variação'] : [])]],
    body: [
      ['Inspeções', String(report.inspections.total), ...(prev ? [String(prev.inspections.total), compare(report.inspections.total, prev.inspections.total, 'count', true)] : [])],
      ['Conformidade (sem nenhum item reprovado)', percent(report.complianceRate), ...(prev ? [percent(prev.complianceRate), compare(report.complianceRate, prev.complianceRate, 'points', true)] : [])],
      ['Inspeções com problema', String(report.inspections.withNc), ...(prev ? [String(prev.inspections.withNc), compare(report.inspections.withNc, prev.inspections.withNc, 'count', false)] : [])],
      ['Não conformidades abertas', String(report.ncs.total), ...(prev ? [String(prev.ncs.total), compare(report.ncs.total, prev.ncs.total, 'count', false)] : [])],
      ['Dessas, ainda ativas', String(report.ncs.active), ...(prev ? [String(prev.ncs.active), ''] : [])],
    ],
    theme: 'grid',
    styles: { fontSize: 9, textColor: TEXT },
    headStyles: { fillColor: [241, 245, 249], textColor: TEXT, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  const severity = report.ncs.bySeverity;
  autoTable(doc, {
    startY: lastY() + 6,
    head: [['NCs por gravidade', 'Crítica', 'Alta', 'Média', 'Baixa']],
    body: [['Quantidade', ...['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((key) => String(severity[key] ?? 0))]],
    theme: 'grid',
    styles: { fontSize: 9, textColor: TEXT, halign: 'center' },
    headStyles: { fillColor: [241, 245, 249], textColor: TEXT, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Por veículo (${rows.length})`, MARGIN, lastY() + 10);
  autoTable(doc, {
    startY: lastY() + 13,
    head: [VEHICLE_COLUMNS],
    body: rows.map(vehicleCells),
    theme: 'striped',
    styles: { fontSize: 7.5, textColor: TEXT, cellPadding: 1.5 },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: MARGIN, right: MARGIN },
  });

  const pages = doc.getNumberOfPages();
  const footer = `Gerado em ${formatDateTime(new Date().toISOString())}${context.generatedBy ? ` por ${context.generatedBy}` : ''} · CHECK-ON`;
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(footer, MARGIN, pageHeight - 6);
    doc.text(`Página ${page} de ${pages}`, pageWidth - MARGIN, pageHeight - 6, { align: 'right' });
  }
  doc.save(reportFileName(report, 'pdf'));
}
