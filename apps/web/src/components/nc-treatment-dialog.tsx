'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Camera, ImagePlus, Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import { shrinkImage } from '@/lib/image';
import { apiErrorMessage, type NC, type NCStatus } from '@/lib/types';
import { NC_STATUS, NcSeverityBadge } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { photoAtWidth } from '@/lib/photo-url';

const MAX_PHOTOS = 3;
const ACTIVE: NCStatus[] = ['OPEN', 'IN_PROGRESS'];

function when(iso?: string | null) {
  return iso ? format(new Date(iso), 'dd/MM/yyyy HH:mm') : '—';
}

/** Miniatura que abre a foto em tamanho real. */
function Thumb({ src, alt, onRemove }: { src: string; alt: string; onRemove?: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative">
      {broken ? (
        <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-2 text-center text-[11px] text-slate-400">
          Foto indisponível
        </div>
      ) : (
        <a href={src} target="_blank" rel="noreferrer" title="Abrir foto em tamanho real">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoAtWidth(src, 320)} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-24 w-24 rounded-md border border-slate-200 object-cover" />
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover foto"
          className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white shadow hover:bg-rose-600"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Tratativa da NC: o "antes" (foto do motorista), o histórico (quem fez o quê, com fotos)
 * e o registro de uma nova ação. Resolver exige descrever o que foi feito; NC crítica exige foto.
 */
export function NcTreatmentDialog({ nc, onClose, onSaved }: { nc: NC | null; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<NC | null>(null);
  const [status, setStatus] = useState<NCStatus>('IN_PROGRESS');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!nc) return;
    setDetail(null);
    setStatus(nc.status === 'OPEN' ? 'IN_PROGRESS' : nc.status);
    setText('');
    setPhotos([]);
    setError('');
    api.get<NC>(`/ncs/${nc.id}`).then((res) => setDetail(res.data)).catch((err) => setError(apiErrorMessage(err, 'Não foi possível carregar a NC.')));
  }, [nc]);

  if (!nc) return null;
  const current = detail ?? nc;
  const closed = current.status === 'CLOSED';
  const resolving = ACTIVE.includes(current.status) && (status === 'RESOLVED' || status === 'CLOSED');
  const critical = current.severity === 'CRITICAL';
  const hadPhoto = (detail?.actions ?? []).some((a) => a.photoUrls.length > 0);
  const needsPhoto = resolving && critical && !hadPhoto && photos.length === 0;
  const needsText = resolving && !text.trim();
  const before = [current.answer?.photoUrl, ...(detail?.recurrences ?? []).map((r) => r.photoUrl)].filter((u): u is string => !!u);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        const form = new FormData();
        form.append('file', await shrinkImage(file));
        const res = await api.post<{ photoUrl: string }>('/ncs/photos', form);
        setPhotos((list) => [...list, res.data.photoUrl].slice(0, MAX_PHOTOS));
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível enviar a foto.'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/ncs/${current.id}/actions`, {
        text: text.trim() || undefined,
        status: status !== current.status ? status : undefined,
        photoUrls: photos.length ? photos : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar a tratativa.'));
    } finally {
      setSaving(false);
    }
  }

  const item = current.item ?? current.answer?.item;
  const vehicle = current.vehicle ?? current.answer?.checklist?.vehicle;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tratativa da NC #{current.id.substring(0, 6).toUpperCase()}</DialogTitle>
          <DialogDescription>
            {closed
              ? 'Esta NC foi encerrada e não pode mais ser alterada.'
              : 'Registre o que foi feito, com fotos. Ao resolver, o status do veículo é recalculado.'}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border bg-slate-50 p-3 text-xs">
          <dt className="text-slate-500">Item</dt>
          <dd className="font-semibold text-slate-800">{item?.text ?? '—'}</dd>
          <dt className="text-slate-500">Veículo</dt>
          <dd className="font-semibold text-slate-800">{vehicle?.plate ?? '—'}</dd>
          <dt className="text-slate-500">Severidade</dt>
          <dd><NcSeverityBadge severity={current.severity} /></dd>
          <dt className="text-slate-500">Situação</dt>
          <dd className="text-slate-800">{NC_STATUS[current.status]?.label ?? current.status}</dd>
          <dt className="text-slate-500">Ocorrências</dt>
          <dd className="text-slate-800">{current.occurrences}{current.occurrences > 1 ? ' (apontada de novo em inspeções seguintes)' : ''}</dd>
          {current.answer?.checklist?.driver && (
            <>
              <dt className="text-slate-500">Aberta por</dt>
              <dd className="text-slate-800">{current.answer.checklist.driver.name} em {when(current.createdAt)}</dd>
            </>
          )}
          {current.answer?.observations && (
            <>
              <dt className="text-slate-500">Relato</dt>
              <dd className="text-slate-800">{current.answer.observations}</dd>
            </>
          )}
        </dl>

        {/* Antes e depois */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Antes (inspeção)</p>
            {before.length ? (
              <div className="flex flex-wrap gap-2">{before.map((src) => <Thumb key={src} src={src} alt="Foto do problema" />)}</div>
            ) : (
              <p className="text-xs text-slate-400">Sem foto do problema.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Depois (tratativa)</p>
            {(detail?.actions ?? []).some((a) => a.photoUrls.length) ? (
              <div className="flex flex-wrap gap-2">
                {(detail?.actions ?? []).flatMap((a) => a.photoUrls).map((src) => <Thumb key={src} src={src} alt="Foto da correção" />)}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Nenhuma foto da correção ainda.</p>
            )}
          </div>
        </div>

        {/* Histórico */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico da tratativa</p>
          {!detail ? (
            <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</p>
          ) : detail.actions?.length ? (
            <ol data-testid="nc-history" className="space-y-3 border-l-2 border-slate-200 pl-4">
              {detail.actions.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-xs text-slate-500">{when(a.createdAt)} · <span className="font-semibold text-slate-700">{a.userName}</span></p>
                  {a.toStatus && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      {a.fromStatus ? NC_STATUS[a.fromStatus]?.label : ''} <ArrowRight className="h-3 w-3" /> {NC_STATUS[a.toStatus]?.label ?? a.toStatus}
                    </p>
                  )}
                  {a.text && <p className="whitespace-pre-wrap text-slate-800">{a.text}</p>}
                  {a.photoUrls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">{a.photoUrls.map((src) => <Thumb key={src} src={src} alt="Foto da tratativa" />)}</div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-400">{current.notes ? `Parecer anterior: ${current.notes}` : 'Nenhum registro ainda.'}</p>
          )}
        </div>

        {!closed && (
          <form onSubmit={save} className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="nc-status">Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus((v || 'IN_PROGRESS') as NCStatus)}>
                <SelectTrigger id="nc-status"><SelectValue placeholder="Selecione a situação" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(NC_STATUS) as NCStatus[]).map((s) => <SelectItem key={s} value={s}>{NC_STATUS[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
              {status === 'CLOSED' && <p className="text-xs text-amber-800">Depois de encerrada, a NC não pode ser reaberta.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nc-text">{resolving ? 'O que foi feito (obrigatório para resolver)' : 'O que foi feito / observação'}</Label>
              <textarea
                id="nc-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ex.: pneu trocado e calibrado na borracharia parceira em 06/11"
              />
            </div>

            <div className="space-y-2">
              <Label>Fotos da correção ({photos.length}/{MAX_PHOTOS}){critical && resolving && !hadPhoto ? ' · obrigatória para resolver NC crítica' : ''}</Label>
              <div className="flex flex-wrap items-center gap-3">
                {photos.map((src) => <Thumb key={src} src={src} alt="Foto a enviar" onRemove={() => setPhotos((list) => list.filter((p) => p !== src))} />)}
                {photos.length < MAX_PHOTOS && (
                  <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()} data-testid="add-photo">
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                    {uploading ? 'Enviando...' : 'Adicionar foto'}
                  </Button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  data-testid="photo-input"
                  onChange={(e) => addPhotos(e.target.files)}
                />
              </div>
              <p className="flex items-center gap-1 text-[11px] text-slate-500"><Camera className="h-3 w-3" /> No celular, abre a câmera. A foto é reduzida antes do envio.</p>
            </div>

            {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
            {!error && (needsText || needsPhoto) && (
              <p className="text-xs text-amber-800">
                {needsText ? 'Descreva o que foi feito para resolver a NC.' : 'Anexe ao menos uma foto da correção: NC crítica.'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saving || uploading || needsText || needsPhoto} data-testid="save-treatment">
                {saving ? 'Salvando...' : resolving ? 'Resolver NC' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        )}
        {closed && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
