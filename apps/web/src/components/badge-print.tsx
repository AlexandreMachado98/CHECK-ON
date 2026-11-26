'use client';

import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/** Um crachá pronto para imprimir: os textos já formatados e o endereço público do QR. */
export type BadgeCard = {
  id: string;
  name: string;
  role: string;
  matricula: string;
  company: string;
  photoUrl?: string | null;
  url: string;
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Abre a janela de impressão no clique (depois disso o navegador bloquearia). */
export function openBadgesWindow(): Window | null {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) win.document.write('<!doctype html><title>Crachás</title><p style="font-family:system-ui;padding:24px">Gerando crachás…</p>');
  return win;
}

/**
 * Crachás em lote, no tamanho de cartão (85,6 × 54 mm), 10 por folha A4. O QR é o mesmo do crachá
 * virtual (página pública de verificação). Espera as fotos carregarem antes de abrir a impressão.
 */
export function BadgesPrint({ cards, skipped, win, onDone }: { cards: BadgeCard[]; skipped: number; win: Window; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const written = useRef(false);

  useEffect(() => {
    if (written.current) return;
    written.current = true;
    const svgs = [...(ref.current?.querySelectorAll('svg') ?? [])].map((svg) => svg.outerHTML);
    const html = cards.map((c, i) => `<div class="card">
  <div class="top"><span class="brand">CHECK-ON</span><span class="tag">Identificação operacional</span></div>
  <div class="body">
    <div class="photo">${c.photoUrl ? `<img src="${escapeHtml(c.photoUrl)}" alt="">` : '<span>sem foto</span>'}</div>
    <div class="info">
      <div class="name">${escapeHtml(c.name)}</div>
      <div class="role">${escapeHtml(c.role)}</div>
      <div class="small">Matrícula</div><div class="mono">${escapeHtml(c.matricula)}</div>
      <div class="company">${escapeHtml(c.company)}</div>
    </div>
    <div class="qr">${svgs[i] ?? ''}</div>
  </div>
  <div class="foot">Válido somente com consulta ativa pelo QR Code</div>
</div>`).join('');
    const note = `${cards.length} crachás, 10 por folha A4, no tamanho de cartão (85,6 × 54 mm). Imprima em tamanho real (100%).`
      + (skipped ? ` ${skipped} da lista ficaram de fora por não terem crachá gerado (abra o crachá do colaborador para gerar).` : '');
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Crachás (${cards.length})</title>
<style>
  /* 5 fileiras de 54 mm + 4 × 2 mm = 278 mm: cabe na altura útil da A4 com margem de 8 mm (281 mm). */
  @page { size: A4; margin: 8mm; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #0f172a; }
  .sheet { display: grid; grid-template-columns: repeat(2, 85.6mm); gap: 2mm 6mm; justify-content: center; }
  .card { width: 85.6mm; height: 54mm; box-sizing: border-box; border: 0.3mm solid #cbd5e1; border-radius: 3mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; }
  .top { background: #0f172a; color: #fff; padding: 1.6mm 3mm; display: flex; justify-content: space-between; align-items: baseline; }
  .brand { font-weight: 800; letter-spacing: .06em; font-size: 8pt; }
  .tag { font-size: 5.5pt; text-transform: uppercase; letter-spacing: .12em; color: #a7f3d0; }
  .body { flex: 1; display: grid; grid-template-columns: 22mm 1fr 27mm; gap: 2.5mm; padding: 2.5mm 3mm; align-items: center; }
  .photo { width: 22mm; height: 29mm; border-radius: 1.5mm; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 5.5pt; color: #64748b; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .name { font-weight: 800; font-size: 9.5pt; line-height: 1.15; }
  .role { color: #047857; font-weight: 600; font-size: 7pt; margin: .6mm 0 1.6mm; }
  .small { font-size: 5pt; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
  .mono { font-family: ui-monospace, monospace; font-weight: 700; font-size: 8pt; }
  .company { margin-top: 1.6mm; font-size: 6pt; color: #475569; }
  .qr svg { width: 27mm; height: 27mm; display: block; }
  .foot { background: #ecfdf5; color: #065f46; font-size: 5.5pt; font-weight: 600; text-align: center; padding: 1.2mm 3mm; letter-spacing: .02em; }
  .note { font-size: 10pt; color: #475569; margin: 0 0 4mm; }
  @media print { .note { display: none; } }
</style></head><body><p class="note">${escapeHtml(note)}</p><div class="sheet">${html}</div>
<script>
  // Imprime depois que as fotos carregam (ou falham), para não sair crachá sem foto.
  const imgs = [...document.images];
  Promise.all(imgs.map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => window.print());
</script></body></html>`);
    win.document.close();
    onDone();
  }, [cards, skipped, win, onDone]);

  return (
    <div ref={ref} aria-hidden="true" className="fixed -left-[10000px] top-0">
      {cards.map((c) => <QRCodeSVG key={c.id} value={c.url} size={160} level="M" includeMargin />)}
    </div>
  );
}
