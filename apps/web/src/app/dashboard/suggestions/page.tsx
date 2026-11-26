'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Phone, Star } from 'lucide-react';
import api from '@/lib/api';
import { canManage } from '@/lib/roles';
import { apiErrorMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notify } from '@/components/feedback';
import { useStoredUser } from '@/lib/use-stored-user';

type Status = 'RECEBIDA' | 'PRIORIZADA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'ARQUIVADA';
type Priority = 'ALTA' | 'MEDIA' | 'BAIXA';
type Action = 'PRIORIZAR' | 'INICIAR' | 'RESOLVER' | 'ARQUIVAR' | 'REABRIR';
interface SuggestionItem {
  id: string;
  protocol: string;
  category: string;
  categoryLabel: string;
  text: string;
  contact: string | null;
  status: Status;
  priority: Priority | null;
  dueDate: string | null;
  response: string | null;
  resolvedAt: string | null;
  handledByName: string | null;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
  vehicle: { id: string; plate: string; prefix: string | null };
  unit: { id: string; name: string };
}
interface Overview {
  days: number;
  counts: Partial<Record<Status, number>>;
  score: { prioritized: number; resolved: number; open: number; withDue: number; onTime: number; rated: number; average: number | null };
  items: SuggestionItem[];
}

const STATUS: Record<Status, { label: string; tab: string; badge: string }> = {
  RECEBIDA: { label: 'Recebida', tab: 'Recebidas', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  PRIORIZADA: { label: 'Priorizada', tab: 'Priorizadas', badge: 'bg-violet-50 text-violet-800 border-violet-200' },
  EM_ANDAMENTO: { label: 'Em andamento', tab: 'Em andamento', badge: 'bg-amber-50 text-amber-900 border-amber-200' },
  RESOLVIDA: { label: 'Resolvida', tab: 'Resolvidas', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  ARQUIVADA: { label: 'Arquivada', tab: 'Arquivadas', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
};
const PRIORITY: Record<Priority, { label: string; badge: string }> = {
  ALTA: { label: 'Prioridade alta', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
  MEDIA: { label: 'Prioridade média', badge: 'bg-amber-50 text-amber-900 border-amber-200' },
  BAIXA: { label: 'Prioridade baixa', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
};
/** Ações de cada situação (mesma regra da API: resolver só depois de priorizar). */
const ACTIONS: Record<Status, { action: Action; label: string; primary?: boolean }[]> = {
  RECEBIDA: [{ action: 'PRIORIZAR', label: 'Priorizar', primary: true }, { action: 'ARQUIVAR', label: 'Arquivar' }],
  PRIORIZADA: [{ action: 'INICIAR', label: 'Iniciar', primary: true }, { action: 'RESOLVER', label: 'Resolver' }, { action: 'PRIORIZAR', label: 'Alterar prioridade' }, { action: 'ARQUIVAR', label: 'Arquivar' }],
  EM_ANDAMENTO: [{ action: 'RESOLVER', label: 'Resolver', primary: true }, { action: 'PRIORIZAR', label: 'Alterar prioridade' }, { action: 'ARQUIVAR', label: 'Arquivar' }],
  RESOLVIDA: [],
  ARQUIVADA: [{ action: 'REABRIR', label: 'Reabrir' }],
};
const TABS: (Status | 'ALL')[] = ['RECEBIDA', 'PRIORIZADA', 'EM_ANDAMENTO', 'RESOLVIDA', 'ARQUIVADA', 'ALL'];
const PERIODS = [{ value: '30', label: 'Últimos 30 dias' }, { value: '90', label: 'Últimos 90 dias' }, { value: '180', label: 'Últimos 6 meses' }, { value: '365', label: 'Último ano' }];
const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy');
const dueDay = (iso: string) => format(new Date(`${iso.slice(0, 10)}T12:00:00`), 'dd/MM/yyyy');

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`Nota ${String(value).replace('.', ',')} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />)}
    </span>
  );
}

/** Priorizar (prioridade e prazo), resolver ou arquivar (resposta ao passageiro). Renderize só aberto. */
function ActionDialog({ item, action, onClose, onDone }: { item: SuggestionItem; action: 'PRIORIZAR' | 'RESOLVER' | 'ARQUIVAR'; onClose: () => void; onDone: () => void }) {
  const [priority, setPriority] = useState<Priority>(item.priority ?? 'MEDIA');
  const [dueDate, setDueDate] = useState(item.dueDate?.slice(0, 10) ?? '');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const title = action === 'PRIORIZAR' ? 'Priorizar sugestão' : action === 'RESOLVER' ? 'Resolver sugestão' : 'Arquivar sugestão';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/suggestions/${item.id}`, action === 'PRIORIZAR' ? { action, priority, ...(dueDate ? { dueDate } : {}) } : { action, response: response.trim() });
      notify(action === 'PRIORIZAR' ? `${item.protocol} priorizada: entra na nota da empresa.` : action === 'RESOLVER' ? `${item.protocol} resolvida. O passageiro pode dar nota pela resposta.` : `${item.protocol} arquivada (fora da nota).`, 'success');
      onDone();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title} · {item.protocol}</DialogTitle>
          <DialogDescription>
            {action === 'PRIORIZAR'
              ? 'Priorizada, a sugestão passa a contar na nota da empresa: a nota é a média das avaliações dos passageiros às soluções.'
              : action === 'RESOLVER'
                ? 'A resposta aparece para o passageiro no link do protocolo, e ele pode dar uma nota para a solução.'
                : 'Arquivada, a sugestão sai da nota da empresa. O motivo aparece para o passageiro.'}
          </DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-line rounded-md border bg-slate-50 p-3 text-sm text-slate-800">{item.text}</p>
        <form onSubmit={save} className="space-y-4">
          {action === 'PRIORIZAR' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sg-priority">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority((v as Priority) || 'MEDIA')}>
                  <SelectTrigger id="sg-priority" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-due">Prazo (opcional)</Label>
                <Input id="sg-due" type="date" value={dueDate} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sg-response">{action === 'RESOLVER' ? 'Resposta ao passageiro: o que foi feito' : 'Motivo para o passageiro'}</Label>
              <textarea
                id="sg-response"
                value={response}
                maxLength={2000}
                rows={4}
                onChange={(e) => setResponse(e.target.value)}
                placeholder={action === 'RESOLVER' ? 'Ex.: a saída passou para 5h50 a partir de segunda-feira.' : 'Ex.: o horário depende do contrato com o cliente e não pode mudar agora.'}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : title.split(' ')[0]}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuggestionsPage() {
  const manager = canManage(useStoredUser()?.role);
  const [days, setDays] = useState('90');
  const [tab, setTab] = useState<Status | 'ALL'>('RECEBIDA');
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<{ item: SuggestionItem; action: 'PRIORIZAR' | 'RESOLVER' | 'ARQUIVAR' } | null>(null);

  // Estado só muda quando a resposta chega.
  const load = useCallback(
    () =>
      api
        .get<Overview>('/suggestions', { params: { days, ...(tab !== 'ALL' ? { status: tab } : {}) } })
        .then((res) => {
          setData(res.data);
          setError('');
        })
        .catch((err) => setError(apiErrorMessage(err, 'Não foi possível carregar as sugestões.')))
        .finally(() => setLoading(false)),
    [days, tab],
  );

  useEffect(() => { void load(); }, [load]);

  async function quick(item: SuggestionItem, action: 'INICIAR' | 'REABRIR') {
    try {
      await api.patch(`/suggestions/${item.id}`, { action });
      notify(action === 'INICIAR' ? `${item.protocol} em andamento.` : `${item.protocol} reaberta.`, 'success');
      void load();
    } catch (err) {
      notify(apiErrorMessage(err, 'Não foi possível salvar.'));
    }
  }

  const score = data?.score;
  const total = data ? Object.values(data.counts).reduce((a, b) => a + (b ?? 0), 0) : 0;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sugestões de melhoria</h1>
          <p className="mt-1 text-sm text-slate-500">Enviadas pelos passageiros pelo QR Code do veículo, na frente de trabalho em que a placa está cadastrada.</p>
        </div>
        <Select value={days} onValueChange={(v) => setDays((v as string) || '90')}>
          <SelectTrigger aria-label="Período" className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="shrink-0 bg-white" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</Button>
        </div>
      )}

      <Card className="mb-6 shadow-sm">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-6">
          <div>
            <p className="text-sm font-medium text-slate-600">Nota da empresa</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{loading || !score ? '—' : score.average === null ? '—' : score.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
              {score?.average != null && <Stars value={score.average} size="h-5 w-5" />}
            </div>
            <p className="text-xs text-slate-600">{score ? (score.rated ? `${score.rated} ${score.rated === 1 ? 'avaliação' : 'avaliações'} de passageiros` : 'Sem avaliações ainda') : ''}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-2xl font-bold tabular-nums">{score?.prioritized ?? '—'}</p><p className="text-xs text-slate-600">Priorizadas</p></div>
            <div><p className="text-2xl font-bold tabular-nums">{score?.resolved ?? '—'}</p><p className="text-xs text-slate-600">Resolvidas</p></div>
            <div><p className="text-2xl font-bold tabular-nums">{score?.open ?? '—'}</p><p className="text-xs text-slate-600">Priorizadas em aberto</p></div>
            <div><p className="text-2xl font-bold tabular-nums">{score ? (score.withDue ? `${score.onTime}/${score.withDue}` : '—') : '—'}</p><p className="text-xs text-slate-600">Resolvidas no prazo</p></div>
          </div>
          <p className="text-xs text-slate-600 sm:col-span-2">A nota conta só as sugestões priorizadas pelo gestor: é a média das notas que os passageiros deram às soluções. Sugestões arquivadas ficam de fora.</p>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Situação">
        {TABS.map((t) => {
          const count = t === 'ALL' ? total : data?.counts[t] ?? 0;
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setLoading(true); setTab(t); }}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
            >
              {t === 'ALL' ? 'Todas' : STATUS[t].tab} <span className="ml-1 tabular-nums font-bold">{loading && !data ? '—' : count}</span>
            </button>
          );
        })}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {!data?.items.length ? (
            <p className="p-8 text-center text-sm text-slate-500">{loading ? 'Carregando...' : tab === 'RECEBIDA' ? 'Nenhuma sugestão esperando avaliação.' : 'Nenhuma sugestão nesta situação.'}</p>
          ) : (
            <ul className="divide-y">
              {data.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{item.protocol}</span>
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS[item.status].badge}`}>{STATUS[item.status].label}</span>
                      {item.priority && <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${PRIORITY[item.priority].badge}`}>{PRIORITY[item.priority].label}</span>}
                      {item.dueDate && item.status !== 'RESOLVIDA' && <span className="text-xs text-slate-600">prazo {dueDay(item.dueDate)}</span>}
                    </div>
                    <p className="text-xs text-slate-600">
                      {item.categoryLabel} · {item.unit.name} · {item.vehicle.prefix ? `${item.vehicle.prefix} · ` : ''}{item.vehicle.plate} · {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                    <p className="whitespace-pre-line text-sm text-slate-900">{item.text}</p>
                    {item.contact && <p className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />{item.contact}</p>}
                    {item.response && (
                      <p className={`rounded-md border px-2 py-1.5 text-xs ${item.status === 'ARQUIVADA' ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                        <strong>{item.status === 'ARQUIVADA' ? 'Motivo do arquivamento' : 'Resposta'}:</strong> {item.response}
                        {item.handledByName && <span> · {item.handledByName}{item.resolvedAt ? ` em ${day(item.resolvedAt)}` : ''}</span>}
                      </p>
                    )}
                    {item.rating != null && (
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                        Nota do passageiro: <Stars value={item.rating} size="h-3.5 w-3.5" />{item.ratingComment && <span>&ldquo;{item.ratingComment}&rdquo;</span>}
                      </p>
                    )}
                    {item.status === 'RESOLVIDA' && item.rating == null && <p className="text-xs text-slate-600">Aguardando a nota do passageiro.</p>}
                  </div>
                  {manager && ACTIONS[item.status].length > 0 && (
                    <div className="flex shrink-0 flex-wrap gap-2 lg:w-44 lg:flex-col">
                      {ACTIONS[item.status].map(({ action, label, primary }) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={primary ? 'default' : 'outline'}
                          aria-label={`${label} ${item.protocol}`}
                          onClick={() => (action === 'INICIAR' || action === 'REABRIR' ? quick(item, action) : setActing({ item, action }))}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {acting && <ActionDialog item={acting.item} action={acting.action} onClose={() => setActing(null)} onDone={load} />}
    </>
  );
}
