'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, ShieldCheck, Trash2, Unlock, X } from 'lucide-react';
import api from '@/lib/api';
import { shrinkImage } from '@/lib/image';
import { photoAtWidth } from '@/lib/photo-url';
import { apiErrorMessage, type EmStatus } from '@/lib/types';
import { EM_STATE, addDaysIso, addMonthsIso, dayBr, emShortText, localIsoToday } from '@/lib/electromechanical';
import { VehicleStatusBadge } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { confirmAction, notify } from '@/components/feedback';

type Inspection = { id: string; performedAt: string; expiresAt: string; provider: string | null; reportNumber: string | null; notes: string | null; photoUrl: string | null; createdByName: string | null };
type Release = { id: string; until: string; reason: string; byName: string | null; endedAt: string | null; createdAt: string };
type Detail = {
  vehicle: { id: string; plate: string; prefix: string | null; model: string | null; status: string; operationalStatus: string };
  em: EmStatus;
  warnDays: number;
  releaseMaxDays: number;
  inspections: Inspection[];
  releases: Release[];
};

const textarea = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Inspeção eletromecânica do veículo: situação, laudos (com a validade do laudo e foto), registro de
 * nova inspeção e, com a inspeção vencida, a liberação provisória com prazo e justificativa.
 * Renderize só quando houver veículo escolhido.
 */
export function ElectromechanicalDialog({ vehicleId, manager, onClose, onChanged }: { vehicleId: string; manager: boolean; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const today = localIsoToday();
  const [performedAt, setPerformedAt] = useState(today);
  const [expiresAt, setExpiresAt] = useState(addMonthsIso(today, 12));
  const [provider, setProvider] = useState('');
  const [reportNumber, setReportNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [releaseUntil, setReleaseUntil] = useState(addDaysIso(today, 7));
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseError, setReleaseError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      api
        .get<Detail>(`/electromechanical/vehicles/${vehicleId}`)
        .then((res) => {
          setDetail(res.data);
          setError('');
        })
        .catch((err) => setError(apiErrorMessage(err, 'Não foi possível carregar a inspeção eletromecânica.'))),
    [vehicleId],
  );
  useEffect(() => { void load(); }, [load]);

  function changed() {
    void load();
    onChanged();
  }

  async function addPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError('');
    try {
      const form = new FormData();
      form.append('file', await shrinkImage(file));
      const res = await api.post<{ photoUrl: string }>('/electromechanical/photos', form);
      setPhotoUrl(res.data.photoUrl);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Não foi possível enviar a foto do laudo.'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/electromechanical/inspections', {
        vehicleId,
        performedAt,
        expiresAt,
        ...(provider.trim() ? { provider: provider.trim() } : {}),
        ...(reportNumber.trim() ? { reportNumber: reportNumber.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(photoUrl ? { photoUrl } : {}),
      });
      notify(`Inspeção eletromecânica registrada: válida até ${dayBr(expiresAt)}.`, 'success');
      setProvider('');
      setReportNumber('');
      setNotes('');
      setPhotoUrl(null);
      changed();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Não foi possível registrar a inspeção.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Inspection) {
    const ok = await confirmAction({ title: 'Excluir este laudo?', message: `Inspeção de ${dayBr(item.performedAt)} (válida até ${dayBr(item.expiresAt)}). A validade do veículo volta a ser a do laudo anterior.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/electromechanical/inspections/${item.id}`);
      notify('Laudo excluído.', 'success');
      changed();
    } catch (err) {
      notify(apiErrorMessage(err, 'Não foi possível excluir o laudo.'));
    }
  }

  async function release(e: React.FormEvent) {
    e.preventDefault();
    setReleaseError('');
    try {
      await api.post(`/electromechanical/vehicles/${vehicleId}/release`, { until: releaseUntil, reason: releaseReason.trim() });
      notify(`Veículo liberado provisoriamente até ${dayBr(releaseUntil)}.`, 'success');
      setReleaseReason('');
      changed();
    } catch (err) {
      setReleaseError(apiErrorMessage(err, 'Não foi possível liberar o veículo.'));
    }
  }

  async function endRelease() {
    const ok = await confirmAction({ title: 'Encerrar a liberação provisória?', message: 'O veículo volta a ficar bloqueado até registrarem a nova inspeção eletromecânica.', confirmLabel: 'Encerrar', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/electromechanical/vehicles/${vehicleId}/release`);
      notify('Liberação encerrada: veículo bloqueado.', 'success');
      changed();
    } catch (err) {
      notify(apiErrorMessage(err, 'Não foi possível encerrar a liberação.'));
    }
  }

  const v = detail?.vehicle;
  const em = detail?.em;
  const expired = em?.state === 'VENCIDA' || em?.state === 'LIBERADA';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{v ? `Inspeção eletromecânica · ${v.plate}` : 'Inspeção eletromecânica'}</DialogTitle>
          <DialogDescription>
            Vencida, a inspeção bloqueia o veículo no portal, no aplicativo e na página do passageiro, até registrarem o laudo novo. O aviso começa {detail?.warnDays ?? 15} dias antes.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {!detail && !error && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Carregando" /></div>}

        {detail && v && em && (
          <div className="space-y-6">
            <div className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${EM_STATE[em.state].badge}`}>
              <div>
                <p className="text-sm font-semibold">{EM_STATE[em.state].label}</p>
                <p className="text-sm">{emShortText(em)}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">Situação do veículo: <VehicleStatusBadge status={v.status} /></div>
            </div>

            {expired && (
              <section aria-labelledby="em-release" className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <h3 id="em-release" className="flex items-center gap-1.5 text-sm font-semibold text-amber-950"><Unlock className="h-4 w-4" aria-hidden="true" /> Liberação provisória</h3>
                {em.state === 'LIBERADA' ? (
                  <div className="mt-2 space-y-2 text-sm text-amber-950">
                    <p>Liberado até <strong>{dayBr(em.releasedUntil)}</strong>. {detail.releases.find((r) => !r.endedAt)?.reason}</p>
                    {manager && <Button size="sm" variant="outline" className="bg-white" onClick={endRelease}>Encerrar liberação</Button>}
                  </div>
                ) : manager ? (
                  <form onSubmit={release} className="mt-2 space-y-3">
                    <p className="text-sm text-amber-950">Use só quando o veículo pode circular com segurança (ex.: laudo já feito, documento a caminho). Fica registrado quem liberou e por quê.</p>
                    <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                      <div className="space-y-1.5">
                        <Label htmlFor="em-until">Liberado até</Label>
                        <Input id="em-until" type="date" value={releaseUntil} min={today} max={addDaysIso(today, detail.releaseMaxDays)} onChange={(e) => setReleaseUntil(e.target.value)} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="em-reason">Justificativa</Label>
                        <textarea id="em-reason" value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} rows={2} maxLength={1000} className={`${textarea} bg-white`} placeholder="Ex.: inspeção feita em 20/11, laudo da oficina chega até sexta." />
                      </div>
                    </div>
                    {releaseError && <p role="alert" className="text-sm text-rose-700">{releaseError}</p>}
                    <Button type="submit" size="sm" disabled={releaseReason.trim().length < 10}>Liberar provisoriamente</Button>
                    <p className="text-xs text-amber-900">No máximo {detail.releaseMaxDays} dias. Registrar o laudo novo libera de vez.</p>
                  </form>
                ) : (
                  <p className="mt-2 text-sm text-amber-950">Só o gestor ou o administrador pode liberar provisoriamente.</p>
                )}
              </section>
            )}

            {manager && (
              <section aria-labelledby="em-new">
                <h3 id="em-new" className="mb-2 text-sm font-semibold text-slate-900">Registrar inspeção (laudo)</h3>
                <form onSubmit={register} className="space-y-3 rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="em-performed">Data da inspeção</Label>
                      <Input id="em-performed" type="date" value={performedAt} max={today} onChange={(e) => { setPerformedAt(e.target.value); if (e.target.value) setExpiresAt(addMonthsIso(e.target.value, 12)); }} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="em-expires">Válida até (conforme o laudo)</Label>
                      <Input id="em-expires" type="date" value={expiresAt} min={performedAt} onChange={(e) => setExpiresAt(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="em-provider">Empresa ou inspetor</Label>
                      <Input id="em-provider" value={provider} maxLength={120} onChange={(e) => setProvider(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="em-report">Número do laudo</Label>
                      <Input id="em-report" value={reportNumber} maxLength={60} onChange={(e) => setReportNumber(e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="em-notes">Observações</Label>
                    <textarea id="em-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={textarea} placeholder="Opcional" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => addPhoto(e.target.files)} aria-label="Foto do laudo" />
                    {photoUrl ? (
                      <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <img src={photoAtWidth(photoUrl, 320)} alt="Foto do laudo" className="h-12 w-12 rounded object-cover" />
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPhotoUrl(null)} aria-label="Tirar a foto do laudo"><X className="h-4 w-4" /></Button>
                      </span>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />} Foto do laudo (opcional)
                      </Button>
                    )}
                    <Button type="submit" size="sm" className="ml-auto" disabled={saving || uploading}>
                      <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />{saving ? 'Registrando...' : 'Registrar inspeção'}
                    </Button>
                  </div>
                  {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
                </form>
              </section>
            )}

            <section aria-labelledby="em-history">
              <h3 id="em-history" className="mb-2 text-sm font-semibold text-slate-900">Laudos registrados</h3>
              {detail.inspections.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhuma inspeção registrada. Sem registro o veículo não é bloqueado, mas também não aparece como em dia para o passageiro.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {detail.inspections.map((i) => (
                    <li key={i.id} className="flex items-start gap-3 p-3 text-sm">
                      {i.photoUrl && (
                        <a href={photoAtWidth(i.photoUrl, 900)} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={photoAtWidth(i.photoUrl, 320)} alt={`Laudo de ${dayBr(i.performedAt)}`} className="h-14 w-14 rounded object-cover" />
                        </a>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">Feita em {dayBr(i.performedAt)} · válida até {dayBr(i.expiresAt)}</p>
                        <p className="text-xs text-slate-600">{[i.provider, i.reportNumber && `laudo ${i.reportNumber}`, i.createdByName && `registrado por ${i.createdByName}`].filter(Boolean).join(' · ')}</p>
                        {i.notes && <p className="whitespace-pre-line text-xs text-slate-700">{i.notes}</p>}
                      </div>
                      {manager && (
                        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-rose-700" onClick={() => remove(i)} aria-label={`Excluir laudo de ${dayBr(i.performedAt)}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detail.releases.length > 0 && (
              <section aria-labelledby="em-releases">
                <h3 id="em-releases" className="mb-2 text-sm font-semibold text-slate-900">Liberações provisórias</h3>
                <ul className="divide-y rounded-md border text-sm">
                  {detail.releases.map((r) => (
                    <li key={r.id} className="p-3">
                      <p className="font-medium text-slate-900">Até {dayBr(r.until)}{r.endedAt ? ' · encerrada' : ''}</p>
                      <p className="text-xs text-slate-600">{r.byName ? `${r.byName}: ` : ''}{r.reason}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
