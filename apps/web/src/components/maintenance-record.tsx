'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { formatKm } from '@/lib/utils';
import { parseMoney, type PlanStatus } from '@/lib/maintenance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notify } from '@/components/feedback';

const OTHER = 'OTHER';

export type RecordTarget = { id: string; plate: string; mileage: number; plans: PlanStatus[]; planId?: string };

/**
 * Registrar uma manutenção feita: o serviço de um plano (reinicia o ciclo dele) ou outro serviço
 * (corretiva). O km lido na oficina também atualiza o km do veículo quando é maior. Renderize só aberto.
 */
export function MaintenanceRecordDialog({ target, onClose, onSaved }: { target: RecordTarget; onClose: () => void; onSaved: () => void }) {
  const [planId, setPlanId] = useState(target.planId ?? target.plans[0]?.planId ?? OTHER);
  const [title, setTitle] = useState('');
  const [performedAt, setPerformedAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [km, setKm] = useState(target.mileage ? String(target.mileage) : '');
  const [workshop, setWorkshop] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const kmValue = km ? Number(km) : NaN;
  const lowerKm = Number.isFinite(kmValue) && target.mileage > 0 && kmValue < target.mileage;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const costValue = parseMoney(cost);
    if (planId === OTHER && !title.trim()) { setError('Descreva o serviço feito.'); return; }
    if (!Number.isFinite(kmValue)) { setError('Informe o km do veículo na manutenção.'); return; }
    if (Number.isNaN(costValue)) { setError('Custo inválido. Use, por exemplo, 1.250,90.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/maintenance/records', {
        vehicleId: target.id,
        ...(planId === OTHER ? { title: title.trim() } : { planId }),
        // Meio-dia no horário local: a data não muda ao converter para UTC.
        performedAt: new Date(`${performedAt}T12:00:00`).toISOString(),
        km: kmValue,
        ...(workshop.trim() ? { workshop: workshop.trim() } : {}),
        ...(costValue !== null ? { cost: costValue } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      notify(`Manutenção registrada em ${target.plate}.`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível registrar a manutenção.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar manutenção · {target.plate}</DialogTitle>
          <DialogDescription>
            {target.mileage ? `Km atual registrado: ${formatKm(target.mileage)}.` : 'Este veículo ainda não tem km registrado.'} O próximo vencimento do plano é contado a partir do km informado aqui.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="record-plan">Serviço</Label>
            <Select value={planId} onValueChange={(v) => setPlanId((v as string) || OTHER)}>
              <SelectTrigger id="record-plan" className="w-full"><SelectValue placeholder="Escolha o serviço" /></SelectTrigger>
              <SelectContent>
                {target.plans.map((p) => <SelectItem key={p.planId} value={p.planId}>{p.planName}</SelectItem>)}
                <SelectItem value={OTHER}>Outro serviço (corretiva ou avulsa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {planId === OTHER && (
            <div className="space-y-1.5">
              <Label htmlFor="record-title">Serviço feito</Label>
              <Input id="record-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Troca da pastilha de freio" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-date">Data</Label>
              <Input id="record-date" type="date" value={performedAt} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setPerformedAt(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-km">Km do veículo</Label>
              <Input id="record-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="Ex.: 60350" aria-describedby={lowerKm ? 'record-km-hint' : undefined} />
              {lowerKm && <p id="record-km-hint" className="text-xs text-amber-800">Menor que o km atual ({formatKm(target.mileage)}). Confira se é de uma manutenção antiga.</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-workshop">Oficina</Label>
              <Input id="record-workshop" value={workshop} maxLength={120} onChange={(e) => setWorkshop(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-cost">Custo (R$)</Label>
              <Input id="record-cost" inputMode="decimal" value={cost} maxLength={16} onChange={(e) => setCost(e.target.value)} placeholder="Opcional, ex.: 1.250,90" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-notes">Observações</Label>
            <textarea
              id="record-notes"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Opcional: peças trocadas, número da OS..."
            />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Registrando...' : 'Registrar manutenção'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
