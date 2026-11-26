'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Bus, CheckCircle2, ChevronRight, LoaderCircle, ShieldCheck, Star, TriangleAlert, UserRound } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';

type DriverOption = { checklistId: string; driverName: string; plate: string; prefix: string | null; model: string | null; completedAt: string | null };
type PublicVehicle = {
  companyName: string;
  vehicle: { plate: string; prefix: string | null; model: string | null };
  current: DriverOption | null;
  others: DriverOption[];
  tags: Record<string, string>;
};
type Step = 'menu' | 'driver' | 'rate' | 'done';

const RATINGS = ['Péssima', 'Ruim', 'Regular', 'Boa', 'Ótima'];
const DEVICE_KEY = 'checkon-passageiro';

/** Identificador aleatório do aparelho (só para não repetir a avaliação); sem armazenamento, segue sem ele. */
function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const vehicleLine = (o: { plate: string; prefix: string | null; model: string | null }) => [o.prefix && `Prefixo ${o.prefix}`, o.plate, o.model].filter(Boolean).join(' · ');

/** Página do passageiro: "Como estou dirigindo?" (identifica o motorista pelo checklist do dia). */
export default function PassengerPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicVehicle | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('menu');
  const [driver, setDriver] = useState<DriverOption | null>(null);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    api.get<PublicVehicle>(`/public/vehicles/${encodeURIComponent(token)}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err, 'Não foi possível abrir esta página. Confira a internet e leia o QR Code de novo.')));
  }, [token]);

  function chooseDriver(option: DriverOption | null) {
    setDriver(option);
    setStep('rate');
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setSendError('Escolha uma nota de 1 a 5 estrelas.'); return; }
    setSending(true);
    setSendError('');
    try {
      await api.post(`/public/vehicles/${encodeURIComponent(token)}/driving`, {
        ...(driver ? { checklistId: driver.checklistId } : {}),
        rating,
        tags,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(contact.trim() ? { contact: contact.trim() } : {}),
        deviceId: deviceId(),
      });
      setStep('done');
    } catch (err) {
      setSendError(apiErrorMessage(err, 'Não foi possível enviar. Confira a internet e tente de novo.'));
    } finally {
      setSending(false);
    }
  }

  const back = (to: Step) => (
    <button type="button" onClick={() => setStep(to)} className="mb-3 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Voltar
    </button>
  );

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="bg-emerald-700 px-4 pb-6 pt-5 text-white">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">CHECK-ON</p>
          <h1 className="mt-1 text-xl font-bold">{data?.companyName ?? 'Canal do passageiro'}</h1>
          {data && (
            <p className="mt-1 flex items-center text-sm text-emerald-50">
              <Bus className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" /> {vehicleLine(data.vehicle)}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto -mt-3 max-w-md px-4 pb-10">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {error ? (
            <div role="alert" className="flex items-start gap-3 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : !data ? (
            <div className="flex justify-center py-8"><LoaderCircle className="h-6 w-6 animate-spin text-slate-400" aria-label="Carregando" /></div>
          ) : step === 'menu' ? (
            <>
              <h2 className="text-lg font-bold">Como podemos ajudar?</h2>
              <p className="mt-1 text-sm text-slate-600">Sua opinião vai direto para a gestão da frota.</p>
              <button
                type="button"
                onClick={() => setStep('driver')}
                className="mt-4 flex w-full items-center gap-3 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-emerald-600 hover:bg-emerald-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Star className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Como estou dirigindo?</span>
                  <span className="block text-sm text-slate-600">Avalie a direção do motorista deste veículo.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </>
          ) : step === 'driver' ? (
            <>
              {back('menu')}
              <h2 className="text-lg font-bold">Quem está dirigindo?</h2>
              {data.current ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">Pela inspeção de hoje, o motorista deste veículo é:</p>
                  <div className="mt-3 rounded-lg border-2 border-emerald-600 bg-emerald-50 p-4">
                    <p className="flex items-center text-lg font-bold"><UserRound className="mr-2 h-5 w-5 text-emerald-700" aria-hidden="true" /> {data.current.driverName}</p>
                    <p className="mt-0.5 text-sm text-slate-700">{vehicleLine(data.current)}</p>
                    {data.current.completedAt && <p className="text-xs text-slate-600">Inspeção feita às {time(data.current.completedAt)}</p>}
                  </div>
                  <button type="button" onClick={() => chooseDriver(data.current)} className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800">
                    É este motorista
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Ainda não há inspeção deste veículo hoje.{data.others.length ? ' Escolha o motorista na lista:' : ''}</p>
              )}
              {data.others.length > 0 && (
                <div className="mt-5">
                  {data.current && <h3 className="text-sm font-semibold text-slate-700">É outro motorista? Escolha:</h3>}
                  <ul className="mt-2 divide-y rounded-lg border">
                    {data.others.map((o) => (
                      <li key={o.checklistId}>
                        <button type="button" onClick={() => chooseDriver(o)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50">
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{o.driverName}</span>
                            <span className="block text-xs text-slate-600">{vehicleLine(o)}{o.completedAt ? ` · inspeção às ${time(o.completedAt)}` : ''}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button type="button" onClick={() => chooseDriver(null)} className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Não sei quem é o motorista
              </button>
            </>
          ) : step === 'rate' ? (
            <form onSubmit={send}>
              {back('driver')}
              <h2 className="text-lg font-bold">Como está a direção?</h2>
              <p className="mt-1 text-sm text-slate-600">{driver ? `${driver.driverName} · ${vehicleLine(driver)}` : `Motorista não identificado · ${vehicleLine(data.vehicle)}`}</p>

              <fieldset className="mt-4">
                <legend className="text-sm font-semibold">Sua nota</legend>
                <div role="radiogroup" aria-label="Nota de 1 a 5 estrelas" className="mt-2 flex justify-between gap-1">
                  {RATINGS.map((label, i) => {
                    const value = i + 1;
                    const on = value <= rating;
                    return (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}: ${label}`}
                        onClick={() => setRating(value)}
                        className="flex flex-1 flex-col items-center rounded-lg py-2 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                      >
                        <Star className={`h-9 w-9 ${on ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />
                        <span className={`mt-1 text-xs ${rating === value ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="mt-5">
                <legend className="text-sm font-semibold">Algo chamou sua atenção? <span className="font-normal text-slate-500">(opcional)</span></legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(data.tags).map(([key, label]) => {
                    const checked = tags.includes(key);
                    return (
                      <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${checked ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-slate-200'}`}>
                        <input type="checkbox" className="h-4 w-4 accent-rose-700" checked={checked} onChange={() => setTags(checked ? tags.filter((t) => t !== key) : [...tags, key])} />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-5">
                <label htmlFor="comment" className="text-sm font-semibold">Comentário <span className="font-normal text-slate-500">(opcional)</span></label>
                <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="Conte o que aconteceu, se quiser" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30" />
              </div>
              <div className="mt-3">
                <label htmlFor="contact" className="text-sm font-semibold">Seu contato <span className="font-normal text-slate-500">(opcional, para retorno)</span></label>
                <input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="Telefone ou e-mail" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30" />
              </div>

              {sendError && <p role="alert" className="mt-3 text-sm text-rose-700">{sendError}</p>}
              <button type="submit" disabled={sending} className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                {sending ? 'Enviando...' : 'Enviar avaliação'}
              </button>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-600">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                A avaliação é anônima e vai só para a gestão da frota. O contato é opcional e usado apenas para responder você.
              </p>
            </form>
          ) : (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold">Obrigado pela avaliação!</h2>
              <p className="mt-1 text-sm text-slate-600">Ela foi enviada para a gestão da frota{rating <= 2 || tags.includes('CELULAR') ? ', que vai tratar o caso' : ''}.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
