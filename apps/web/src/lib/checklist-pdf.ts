// ─── PDF da inspeção ─────────────────────────────────────────────────────────
//
// Gerado no navegador, a partir dos mesmos dados dos detalhes da inspeção (já filtrados pela
// empresa e pelas frentes de trabalho de quem está logado). As bibliotecas só são carregadas
// quando a pessoa pede o PDF. Fotos entram reduzidas, para o arquivo não ficar pesado.

import type { Checklist, ChecklistAnswer } from './types';
import { NC_SEVERITY, NC_STATUS } from './status';

const BRAND: [number, number, number] = [5, 150, 105]; // verde CHECK-ON
const TEXT: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const DANGER: [number, number, number] = [190, 18, 60];
const PHOTO_MAX_SIDE = 900;
const MARGIN = 14;

export interface PdfContext {
  /** Empresa (nome) de quem gerou. */
  companyName?: string | null;
  /** Quem gerou o PDF (aparece no rodapé). */
  generatedBy?: string | null;
}

/** "1 item" / "3 itens". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "21/11/2026 14:05" no fuso do navegador. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Nome do arquivo: inspecao_ABC1D23_2026-11-21_1405.pdf */
export function pdfFileName(checklist: Checklist): string {
  const plate = (checklist.vehicle?.plate ?? 'veiculo').replace(/[^A-Za-z0-9]/g, '');
  const date = new Date(checklist.completedAt ?? checklist.startedAt);
  const stamp = Number.isNaN(date.getTime())
    ? 'sem-data'
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `inspecao_${plate}_${stamp}.pdf`;
}

/** Resposta em texto, como aparece na tabela. */
export function answerLabel(answer: ChecklistAnswer): string {
  if (answer.notApplicable) return 'N/A (não se aplica)';
  const type = answer.itemType ?? answer.item?.type;
  const parts: string[] = [];
  if (type === 'PASS_FAIL' || (!answer.textValue && answer.numberValue == null && !answer.photoUrl)) {
    parts.push(answer.isCompliant ? 'Conforme' : 'Não conforme');
  } else if (!answer.isCompliant) {
    parts.push('Não conforme');
  }
  if (answer.numberValue !== null && answer.numberValue !== undefined) parts.push(answer.numberValue.toLocaleString('pt-BR'));
  if (answer.textValue) parts.push(answer.textValue);
  if (answer.photoUrl) parts.push('Foto (ver página de fotos)');
  return parts.join(' · ');
}

/** Respostas agrupadas pela seção do modelo, na ordem em que aparecem. */
export function groupBySection(answers: ChecklistAnswer[]): { section: string; answers: ChecklistAnswer[] }[] {
  const groups: { section: string; answers: ChecklistAnswer[] }[] = [];
  for (const answer of answers) {
    const section = answer.categoryName?.trim() || 'Itens inspecionados';
    let group = groups.find((item) => item.section === section);
    if (!group) {
      group = { section, answers: [] };
      groups.push(group);
    }
    group.answers.push(answer);
  }
  return groups;
}

/** Totais do resumo: N/A fica fora da conta de conformes e não conformes. */
export function summarize(answers: ChecklistAnswer[]) {
  const applicable = answers.filter((answer) => !answer.notApplicable);
  const nonCompliant = applicable.filter((answer) => !answer.isCompliant);
  return {
    total: answers.length,
    compliant: applicable.length - nonCompliant.length,
    nonCompliant: nonCompliant.length,
    critical: nonCompliant.filter((answer) => answer.itemIsCritical ?? answer.item?.isCritical).length,
    notApplicable: answers.length - applicable.length,
  };
}

/** Foto reduzida em JPEG (data URL), ou null se não abrir. */
async function loadPhoto(url: string): Promise<{ data: string; width: number; height: number } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { data: canvas.toDataURL('image/jpeg', 0.72), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** Gera e baixa o PDF da inspeção (com as respostas já carregadas). */
export async function downloadChecklistPdf(checklist: Checklist, context: PdfContext = {}): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const answers = checklist.answers ?? [];
  const totals = summarize(answers);
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN;

  // ── Cabeçalho ──
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de inspeção', MARGIN, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const templateName = checklist.templateName || checklist.template?.name || 'Checklist';
  const version = checklist.templateVersion ? ` (versão ${checklist.templateVersion})` : '';
  doc.text(`${templateName}${version}`, MARGIN, 18);
  doc.setFont('helvetica', 'bold');
  doc.text('CHECK-ON', pageWidth - MARGIN, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  if (context.companyName) doc.text(context.companyName, pageWidth - MARGIN, 18, { align: 'right' });

  // ── Dados da inspeção ──
  const vehicle = checklist.vehicle;
  const unit = vehicle?.fleet?.unit;
  const vehicleText = [vehicle?.plate, vehicle?.prefix ? `prefixo ${vehicle.prefix}` : null, [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
  const driver = checklist.driver;
  const location =
    checklist.latitude != null && checklist.longitude != null
      ? `${checklist.latitude.toFixed(5)}, ${checklist.longitude.toFixed(5)}`
      : 'Não informada';
  const info: [string, string][] = [
    ['Veículo', vehicleText || '—'],
    ['Frota', vehicle?.fleet?.name ?? '—'],
    ['Frente de trabalho', unit ? `${unit.name}${unit.client ? ` · ${unit.client}` : ''}` : '—'],
    ['Motorista / inspetor', driver ? `${driver.name}${driver.matricula ? ` · matrícula ${driver.matricula}` : ''}` : '—'],
    ['Início', formatDateTime(checklist.startedAt)],
    ['Conclusão', formatDateTime(checklist.completedAt)],
    ['Recebida pelo servidor', formatDateTime(checklist.syncedAt)],
    ['Localização', location],
  ];
  if (checklist.deviceInfo) info.push(['Aparelho', checklist.deviceInfo]);
  info.push(['Código da inspeção', checklist.id]);

  autoTable(doc, {
    startY: 30,
    margin: { left: MARGIN, right: MARGIN },
    body: info,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4, textColor: TEXT },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: MUTED } },
  });

  // ── Resumo ──
  let y = lastY() + 5;
  const result = totals.nonCompliant > 0 ? plural(totals.nonCompliant, 'item não conforme', 'itens não conformes') : 'Todos os itens conformes';
  doc.setFillColor(totals.nonCompliant > 0 ? 255 : 236, totals.nonCompliant > 0 ? 241 : 253, totals.nonCompliant > 0 ? 242 : 245);
  doc.roundedRect(MARGIN, y, contentWidth, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...(totals.nonCompliant > 0 ? DANGER : BRAND));
  doc.text(result, MARGIN + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const summaryLine = [
    plural(totals.total, 'item', 'itens'),
    plural(totals.compliant, 'conforme', 'conformes'),
    plural(totals.nonCompliant, 'não conforme', 'não conformes'),
    totals.critical ? plural(totals.critical, 'crítico', 'críticos') : null,
    totals.notApplicable ? `${totals.notApplicable} N/A` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  doc.text(summaryLine, MARGIN + 4, y + 11);
  y += 20;

  // ── Respostas por seção ──
  for (const group of groupBySection(answers)) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, bottom: 16 },
      head: [[group.section, 'Resposta', 'Observação']],
      body: group.answers.map((answer) => {
        const critical = answer.itemIsCritical ?? answer.item?.isCritical;
        const nc = answer.nonConformity
          ? `NC ${NC_SEVERITY[answer.nonConformity.severity]?.label.toLowerCase() ?? ''} · ${NC_STATUS[answer.nonConformity.status]?.label ?? answer.nonConformity.status}`
          : answer.recurrentNcId
            ? 'Reincidência de NC em tratativa'
            : '';
        return [
          `${answer.itemText || answer.item?.text || 'Item'}${critical ? ' (crítico)' : ''}`,
          answerLabel(answer),
          [answer.observations, nc].filter(Boolean).join('\n'),
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: TEXT, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2, textColor: TEXT, lineColor: [226, 232, 240], valign: 'top' },
      columnStyles: { 0: { cellWidth: contentWidth * 0.42 }, 1: { cellWidth: contentWidth * 0.25 } },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 1) return;
        const answer = group.answers[data.row.index];
        if (!answer.notApplicable && !answer.isCompliant) {
          data.cell.styles.textColor = DANGER;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = lastY() + 4;
  }

  // ── Fotos ──
  const withPhotos = answers.filter((answer) => answer.photoUrl);
  if (withPhotos.length) {
    const photos = await Promise.all(withPhotos.map((answer) => loadPhoto(answer.photoUrl as string)));
    const columnWidth = (contentWidth - 6) / 2;
    const boxHeight = 62;
    doc.addPage();
    y = MARGIN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...TEXT);
    doc.text('Fotos', MARGIN, y + 4);
    y += 10;
    withPhotos.forEach((answer, index) => {
      const column = index % 2;
      if (column === 0 && index > 0) y += boxHeight + 12;
      if (column === 0 && y + boxHeight + 10 > pageHeight - 16) {
        doc.addPage();
        y = MARGIN;
      }
      const x = MARGIN + column * (columnWidth + 6);
      const photo = photos[index];
      if (photo) {
        const scale = Math.min(columnWidth / photo.width, boxHeight / photo.height);
        const width = photo.width * scale;
        const height = photo.height * scale;
        doc.addImage(photo.data, 'JPEG', x + (columnWidth - width) / 2, y + (boxHeight - height) / 2, width, height);
      } else {
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, y, columnWidth, boxHeight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text('Foto indisponível', x + columnWidth / 2, y + boxHeight / 2, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT);
      const caption = doc.splitTextToSize(`${answer.itemText || answer.item?.text || 'Item'} · ${answerLabel(answer).replace(' · Foto (ver página de fotos)', '').replace('Foto (ver página de fotos)', 'Foto')}`, columnWidth);
      doc.text(caption.slice(0, 2), x, y + boxHeight + 4);
    });
  }

  // ── Rodapé em todas as páginas ──
  const pages = doc.getNumberOfPages();
  const generated = `Gerado em ${formatDateTime(new Date().toISOString())}${context.generatedBy ? ` por ${context.generatedBy}` : ''} · CHECK-ON`;
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(generated, MARGIN, pageHeight - 8);
    doc.text(`Página ${page} de ${pages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
  }

  doc.save(pdfFileName(checklist));
}
