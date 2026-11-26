'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { DashboardSummary } from '@/lib/types';

type Step = { done: boolean; title: string; hint: string; href?: string; action?: string };

/** Passos da implantação, na ordem em que um cliente novo precisa fazer. */
export function firstSteps(summary: DashboardSummary): Step[] {
  const setup = summary.setup;
  return [
    { done: summary.activeFleets > 0, title: 'Criar uma frota', hint: 'Agrupe os veículos por base, contrato ou tipo.', href: '/dashboard/fleets', action: 'Criar frota' },
    { done: summary.activeVehicles > 0, title: 'Cadastrar os veículos', hint: 'Placa e prefixo; cada veículo ganha um QR Code para a inspeção.', href: '/dashboard/fleets', action: 'Cadastrar veículo' },
    { done: !!setup?.hasTemplate, title: 'Montar o checklist', hint: 'Os itens que o motorista vai conferir, com os críticos que bloqueiam o veículo.', href: '/dashboard/templates', action: 'Criar modelo' },
    { done: !!setup?.hasAppAccess, title: 'Cadastrar os motoristas e liberar o aplicativo', hint: 'Cada um entra no app com o código da empresa e a matrícula.', href: '/dashboard/employees', action: 'Cadastrar colaborador' },
    { done: !!setup?.hasInspection, title: 'Fazer a primeira inspeção', hint: 'No celular do motorista: instalar o app, entrar e ler o QR Code do veículo.' },
  ];
}

/**
 * Cartão de implantação no painel: aparece para quem pode cadastrar enquanto falta algum passo
 * (empresa nova), mostra o próximo a fazer e some sozinho quando a primeira inspeção chega.
 */
export function FirstSteps({ summary }: { summary: DashboardSummary }) {
  const steps = firstSteps(summary);
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);

  return (
    <Card className="mb-6 border-emerald-200 bg-emerald-50/40 shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900">Primeiros passos</h2>
          <p className="text-sm text-slate-600">{doneCount} de {steps.length} concluídos</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Concluído" />
              ) : step.href ? (
                <Circle className={`mt-0.5 h-5 w-5 shrink-0 ${i === next ? 'text-emerald-700' : 'text-slate-400'}`} aria-label="A fazer" />
              ) : (
                <Smartphone className={`mt-0.5 h-5 w-5 shrink-0 ${i === next ? 'text-emerald-700' : 'text-slate-400'}`} aria-label="A fazer" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${step.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{step.title}</p>
                {!step.done && <p className="text-xs text-slate-600">{step.hint}</p>}
              </div>
              {!step.done && i === next && step.href && (
                <Link
                  href={step.href}
                  className="inline-flex shrink-0 items-center rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  {step.action}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
