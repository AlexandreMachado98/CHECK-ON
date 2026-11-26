'use client';

import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export type PassengerLabel = { id: string; plate: string; prefix: string | null; passengerToken: string };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Endereço da página do passageiro (o mesmo domínio do portal, ou NEXT_PUBLIC_APP_URL). */
export function passengerUrl(token: string): string {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  return `${origin}/v/${token}`;
}

/**
 * Adesivos "Como estou dirigindo?" para colar dentro do veículo (4 por folha A4). O QR abre a
 * página pública do passageiro; é diferente do QR da inspeção (o motorista não confunde os dois).
 */
export function PassengerLabelsPrint({ labels, company, win, onDone }: { labels: PassengerLabel[]; company: string; win: Window; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const written = useRef(false);

  useEffect(() => {
    if (written.current) return;
    written.current = true;
    const svgs = [...(ref.current?.querySelectorAll('svg') ?? [])].map((svg) => svg.outerHTML);
    const html = labels.map((l, i) => `<div class="label">
  <div class="title">Como estou dirigindo?</div>
  <div class="lead">Aponte a câmera do celular e avalie a direção</div>
  ${svgs[i] ?? ''}
  <div class="plate">${escapeHtml(l.prefix ? `${l.prefix} · ${l.plate}` : l.plate)}</div>
  <div class="foot">${escapeHtml(company)} · avaliação anônima · CHECK-ON</div>
</div>`).join('');
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR do passageiro (${labels.length})</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #0f172a; }
  .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
  .label { border: 0.8mm solid #047857; border-radius: 5mm; padding: 5mm 4mm; text-align: center; height: 132mm; box-sizing: border-box; break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .title { font-size: 20pt; font-weight: 900; color: #047857; line-height: 1.1; }
  .lead { font-size: 11pt; color: #334155; margin: 2mm 0 1mm; }
  svg { width: 70mm; height: 70mm; display: block; margin: 2mm auto; }
  .plate { font-size: 16pt; font-weight: 800; letter-spacing: .05em; }
  .foot { font-size: 8pt; color: #64748b; margin-top: 2mm; }
  .note { font-size: 10pt; color: #475569; margin-bottom: 4mm; }
  @media print { .note { display: none; } }
</style></head><body><p class="note">${labels.length} adesivos, 4 por folha A4. Imprima em tamanho real (100%) e cole à vista dos passageiros. Cada QR é de um veículo: cole no veículo da placa indicada.</p>
<div class="sheet">${html}</div><script>window.onload = () => { window.print(); };</script></body></html>`);
    win.document.close();
    onDone();
  }, [labels, company, win, onDone]);

  return (
    <div ref={ref} aria-hidden="true" className="fixed -left-[10000px] top-0">
      {labels.map((l) => <QRCodeSVG key={l.id} value={passengerUrl(l.passengerToken)} size={240} level="M" includeMargin />)}
    </div>
  );
}
