'use client';

import Link from 'next/link';
import { AlertTriangle, Lightbulb, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PassengerTotals } from '@/lib/report-export';

const one = (value: number | null) => (value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`Nota ${one(value)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />)}
    </span>
  );
}

function Line({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

/** Canais do passageiro no relatório: avaliações de direção e sugestões de melhoria do período. */
export function ReportPassengers({ data }: { data: PassengerTotals }) {
  const d = data.driving;
  const s = data.suggestions;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
            <Star className="h-4 w-4 text-amber-500" aria-hidden="true" /> Como estou dirigindo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{one(d.average)}</span>
            {d.average !== null && <Stars value={d.average} />}
          </div>
          <p className="text-xs text-slate-600">Nota média da direção dada pelos passageiros</p>
          <Line label="Avaliações no período" value={d.count} />
          <Line label="Alertas (nota 1-2 ou celular)" value={d.alerts} />
          <Line label="Alertas tratados" value={`${d.alertsTreated} de ${d.alerts}`} />
          {d.alerts > d.alertsTreated && (
            <Link href="/dashboard/driving" className="flex items-center gap-1.5 text-sm font-medium text-rose-700 hover:underline">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {d.alerts - d.alertsTreated} sem tratativa
            </Link>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
            <Lightbulb className="h-4 w-4 text-sky-600" aria-hidden="true" /> Sugestões de melhoria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{s.rated ? one(s.average) : '—'}</span>
            {s.rated > 0 && s.average !== null && <Stars value={s.average} />}
          </div>
          <p className="text-xs text-slate-600">Nota da empresa: média das notas dos passageiros às sugestões priorizadas e resolvidas{s.rated ? ` (${s.rated} ${s.rated === 1 ? 'avaliação' : 'avaliações'})` : ''}</p>
          <Line label="Recebidas no período" value={s.received} />
          <Line label="Priorizadas / resolvidas" value={`${s.prioritized} / ${s.resolved}`} />
          <Line label="Resolvidas no prazo" value={s.withDue ? `${s.onTime} de ${s.withDue}` : '—'} />
          <Line label="Arquivadas (fora da nota)" value={s.archived} />
        </CardContent>
      </Card>
    </div>
  );
}
