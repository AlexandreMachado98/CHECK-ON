'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import type { Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Conteúdo do QR lido pelo aplicativo CHECK-ON (precisa bater com VEHICLE_QR_PREFIX em apps/mobile/src/lib/rules.ts). */
export function vehicleQrValue(vehicleId: string): string {
  return `CHECKON:VEICULO:${vehicleId}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Etiqueta com o QR Code do veículo, para imprimir e colar no veículo. */
export function VehicleQrDialog({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null);
  if (!vehicle) return null;
  const subtitle = [vehicle.prefix ? `Prefixo ${vehicle.prefix}` : null, [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || null]
    .filter(Boolean)
    .join(' · ');

  function print() {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!svg || !win) return;
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR Code ${escapeHtml(vehicle!.plate)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; display: flex; justify-content: center; }
  .label { border: 2px solid #0f172a; border-radius: 16px; padding: 20px 24px; margin: 24px; text-align: center; width: 300px; }
  .brand { font-weight: 800; color: #059669; letter-spacing: .08em; font-size: 14px; }
  .plate { font-size: 34px; font-weight: 900; letter-spacing: .06em; margin: 6px 0 2px; }
  .sub { color: #475569; font-size: 13px; min-height: 16px; }
  svg { width: 240px; height: 240px; margin: 10px auto 6px; display: block; }
  .hint { font-size: 12px; color: #475569; }
</style></head><body><div class="label">
  <div class="brand">CHECK-ON</div>
  <div class="plate">${escapeHtml(vehicle!.plate)}</div>
  <div class="sub">${escapeHtml(subtitle)}</div>
  ${svg}
  <div class="hint">Leia no aplicativo CHECK-ON para iniciar a inspeção</div>
</div><script>window.onload = () => { window.print(); };</script></body></html>`);
    win.document.close();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code de {vehicle.plate}</DialogTitle>
          <DialogDescription>
            Imprima e cole no veículo. No aplicativo, o motorista lê este QR Code para abrir o veículo e começar a inspeção, mesmo sem internet.
          </DialogDescription>
        </DialogHeader>
        <div ref={qrRef} className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-xs font-bold tracking-widest text-emerald-700">CHECK-ON</p>
          <p className="text-2xl font-black tracking-wider text-slate-900">{vehicle.plate}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          <QRCodeSVG data-testid="vehicle-qr" value={vehicleQrValue(vehicle.id)} size={200} level="M" includeMargin aria-label={`QR Code do veículo ${vehicle.plate}`} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={print}><Printer className="mr-2 h-4 w-4" />Imprimir etiqueta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
