'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, LoaderCircle, Star, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';

type Status = 'RECEBIDA' | 'PRIORIZADA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'ARQUIVADA';
type Follow = {
  companyName: string;
  protocol: string;
  category: string;
  text: string;
  createdAt: string;
  status: Status;
  priority: 'ALTA' | 'MEDIA' | 'BAIXA' | null;
  dueDate: string | null;
  response: string | null;
  resolvedAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  canRate: boolean;
  vehicle: { plate: string; prefix: string | null };
};

const STEPS: { status: Status; label: string; hint: string }[] = [
  { status: 'RECEBIDA', label: 'Recebida', hint: 'A gestão vai avaliar a sugestão.' },
  { status: 'PRIORIZADA', label: 'Priorizada', hint: 'A empresa decidiu resolver.' },
  { status: 'EM_ANDAMENTO', label: 'Em andamento', hint: 'A solução está sendo feita.' },
  { status: 'RESOLVIDA', label: 'Resolvida', hint: 'Veja a resposta e dê sua nota.' },
];
const PRIORITY = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
const RATINGS = ['Péssima', 'Ruim', 'Regular', 'Boa', 'Ótima'];
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR');

/** Acompanhamento da sugestão pelo passageiro: situação, resposta da empresa e nota da solução. */
export default function FollowSuggestion({ token }: { token: string }) {
  const [data, setData] = useState<Follow | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const load = useCallback(() => {
    api.get<Follow>(`/public/suggestions/${encodeURIComponent(token)}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err, 'Não foi possível abrir o protocolo. Confira a internet e tente de novo.')));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function rate(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setSendError('Escolha uma nota de 1 a 5 estrelas.'); return; }
    setSending(true);
    setSendError('');
    try {
      await api.post(`/public/suggestions/${encodeURIComponent(token)}/rating`, { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      load();
    } catch (err) {
      setSendError(apiErrorMessage(err, 'Não foi possível enviar a nota. Tente de novo.'));
    } finally {
      setSending(false);
    }
  }

  const reached = data ? STEPS.findIndex((s) => s.status === data.status) : -1;

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="bg-emerald-700 px-4 pb-6 pt-5 text-white">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">CHECK-ON</p>
          <h1 className="mt-1 text-xl font-bold">{data?.companyName ?? 'Sugestão de melhoria'}</h1>
          {data && <p className="mt-1 text-sm text-emerald-50">Protocolo <span className="font-mono font-bold">{data.protocol}</span></p>}
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
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{data.category} · enviada em {day(data.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{data.text}</p>
                <p className="mt-1 text-xs text-slate-600">Veículo {data.vehicle.prefix ? `${data.vehicle.prefix} · ` : ''}{data.vehicle.plate}</p>
              </div>

              {data.status === 'ARQUIVADA' ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">A empresa não vai seguir com esta sugestão agora</p>
                  {data.response && <p className="mt-1 whitespace-pre-line text-slate-700">{data.response}</p>}
                </div>
              ) : (
                <ol className="space-y-3" aria-label="Andamento da sugestão">
                  {STEPS.map((s, i) => {
                    const done = i <= reached;
                    return (
                      <li key={s.status} className="flex items-start gap-3" aria-current={i === reached ? 'step' : undefined}>
                        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />}
                        <div>
                          <p className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-500'}`}>
                            {s.label}
                            {s.status === 'PRIORIZADA' && data.priority && done && <span className="font-normal text-slate-600"> · prioridade {PRIORITY[data.priority]}{data.dueDate ? `, previsão ${day(data.dueDate)}` : ''}</span>}
                            {s.status === 'RESOLVIDA' && data.resolvedAt && <span className="font-normal text-slate-600"> · {day(data.resolvedAt)}</span>}
                          </p>
                          {i === reached && <p className="text-xs text-slate-600">{s.hint}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {data.status === 'RESOLVIDA' && data.response && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <p className="font-semibold text-emerald-900">Resposta da empresa</p>
                  <p className="mt-1 whitespace-pre-line text-emerald-950">{data.response}</p>
                </div>
              )}

              {data.canRate ? (
                <form onSubmit={rate} className="border-t pt-4">
                  <h2 className="text-base font-bold">O que achou da solução?</h2>
                  <div role="radiogroup" aria-label="Nota da solução de 1 a 5 estrelas" className="mt-2 flex justify-between gap-1">
                    {RATINGS.map((label, i) => {
                      const value = i + 1;
                      return (
                        <button key={label} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}: ${label}`} onClick={() => setRating(value)} className="flex flex-1 flex-col items-center rounded-lg py-2 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                          <Star className={`h-9 w-9 ${value <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />
                          <span className={`mt-1 text-xs ${rating === value ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label htmlFor="rating-comment" className="mt-3 block text-sm font-semibold">Comentário <span className="font-normal text-slate-500">(opcional)</span></label>
                  <textarea id="rating-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30" />
                  {sendError && <p role="alert" className="mt-2 text-sm text-rose-700">{sendError}</p>}
                  <button type="submit" disabled={sending} className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                    {sending ? 'Enviando...' : 'Enviar nota'}
                  </button>
                </form>
              ) : data.rating ? (
                <div className="border-t pt-4 text-sm">
                  <p className="font-semibold">Sua nota para a solução</p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="inline-flex" role="img" aria-label={`Nota ${data.rating} de 5`}>
                      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-5 w-5 ${i <= data.rating! ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />)}
                    </span>
                    Obrigado!
                  </p>
                  {data.ratingComment && <p className="mt-1 text-slate-700">&ldquo;{data.ratingComment}&rdquo;</p>}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
