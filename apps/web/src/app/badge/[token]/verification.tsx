'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  AlertTriangle, BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2,
  GraduationCap, Hash, LoaderCircle, ShieldCheck, User,
} from 'lucide-react';

interface PublicTraining {
  name: string;
  completedAt: string;
  expiresAt?: string | null;
}

interface PublicBadge {
  name: string;
  photoUrl?: string | null;
  matricula?: string | null;
  jobTitle?: string | null;
  departmentName?: string | null;
  admissionDate?: string | null;
  supervisor?: { name: string; jobTitle?: string | null } | null;
  companyName: string;
  companyIntegrationDate?: string | null;
  companyIntegrationExpiresAt?: string | null;
  clientIntegrationDate?: string | null;
  clientIntegrationExpiresAt?: string | null;
  trainings: PublicTraining[];
  verifiedAt: string;
}

function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

function validity(expiresAt?: string | null) {
  if (!expiresAt) return { label: 'Validade não informada', theme: 'neutral' as const };
  const expiry = expiresAt.slice(0, 10);
  const now = new Date().toISOString().slice(0, 10);
  if (expiry < now) return { label: 'Vencida', theme: 'expired' as const };
  const daysLeft = Math.ceil((new Date(`${expiry}T00:00:00`).getTime() - new Date(`${now}T00:00:00`).getTime()) / 86400000);
  if (daysLeft <= 30) return { label: 'Vence em breve', theme: 'soon' as const };
  return { label: 'Em dia', theme: 'valid' as const };
}

function ValidityPill({ expiresAt }: { expiresAt?: string | null }) {
  const status = validity(expiresAt);
  const colors = {
    valid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    soon: 'bg-amber-50 text-amber-800 ring-amber-200',
    expired: 'bg-rose-50 text-rose-700 ring-rose-200',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${colors[status.theme]}`}>{status.label}</span>;
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-medium leading-5 text-slate-800">{value || 'Não informado'}</p>
      </div>
    </div>
  );
}

function IntegrationCard({ title, completedAt, expiresAt }: { title: string; completedAt?: string | null; expiresAt?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="mt-1.5 text-xs text-slate-500">Realizada em {formatDate(completedAt)}</p>
          <p className="mt-0.5 text-xs text-slate-500">Válida até {formatDate(expiresAt)}</p>
        </div>
        <ValidityPill expiresAt={expiresAt} />
      </div>
    </div>
  );
}

export default function BadgeVerification({ token }: { token: string }) {
  const [badge, setBadge] = useState<PublicBadge | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    api.get<PublicBadge>(`/public/badges/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!active) return;
        setBadge(response.data);
        setState('ready');
      })
      .catch((error: { response?: { status?: number } }) => {
        if (!active) return;
        setState(error.response?.status === 404 ? 'invalid' : 'error');
      });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-slate-100 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-900/10">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-wide text-slate-900">CHECK-ON</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Verificação de identificação</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 sm:inline-flex">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Consulta segura
          </span>
        </header>

        {state === 'loading' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-emerald-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-slate-600">Verificando identificação…</p>
          </section>
        )}

        {(state === 'invalid' || state === 'error') && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-slate-900">
              {state === 'invalid' ? 'Crachá indisponível' : 'Não foi possível verificar'}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {state === 'invalid'
                ? 'Este link pode ter sido revogado ou o cadastro está inativo. Solicite a confirmação diretamente ao responsável da empresa.'
                : 'A consulta não foi concluída. Verifique a conexão e tente novamente.'}
            </p>
            {state === 'error' && <button type="button" className="mt-5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => window.location.reload()}>Tentar novamente</button>}
          </section>
        )}

        {state === 'ready' && badge && (
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white sm:px-8 sm:py-8">
              <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full border border-white/10" />
              <div className="absolute -right-2 -top-12 h-40 w-40 rounded-full border border-white/10" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">Identificação de colaborador</p>
                  <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">{badge.companyName}</h1>
                  <p className="mt-1 text-sm text-slate-300">Crachá operacional virtual</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Identificação válida
                </span>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-8">
              <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="flex h-40 w-36 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-slate-400 shadow-sm">
                  {badge.photoUrl ? <img src={badge.photoUrl} alt={`Foto de identificação de ${badge.name}`} className="h-full w-full object-cover" /> : <User className="h-14 w-14" aria-hidden="true" />}
                </div>
                <h2 className="mt-4 break-words text-lg font-bold leading-tight text-slate-950">{badge.name}</h2>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{badge.jobTitle || 'Função não informada'}</p>
                <p className="mt-3 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                  Matrícula {badge.matricula || 'não informada'}
                </p>
              </div>

              <div className="min-w-0">
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <Detail icon={<CalendarDays />} label="Data de admissão" value={formatDate(badge.admissionDate)} />
                  <Detail icon={<Building2 />} label="Setor" value={badge.departmentName} />
                  <Detail icon={<BriefcaseBusiness />} label="Supervisor responsável" value={badge.supervisor?.name} />
                  <Detail icon={<Hash />} label="Função" value={badge.jobTitle} />
                </div>
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Building2 className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Integrações e validade
                  </h3>
                  <div className="grid gap-3">
                    <IntegrationCard title="Integração da empresa" completedAt={badge.companyIntegrationDate} expiresAt={badge.companyIntegrationExpiresAt} />
                    <IntegrationCard title="Integração do cliente" completedAt={badge.clientIntegrationDate} expiresAt={badge.clientIntegrationExpiresAt} />
                  </div>
                </div>
              </div>
            </div>

            <section className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-8 sm:py-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-900">Treinamentos do colaborador</h3>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">{badge.trainings.length} registro{badge.trainings.length === 1 ? '' : 's'}</span>
              </div>
              {badge.trainings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">Não há treinamentos registrados neste crachá.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {badge.trainings.map((training, index) => (
                    <div key={`${training.name}-${index}`} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-800">{training.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Realizado em {formatDate(training.completedAt)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Válido até {formatDate(training.expiresAt)}</p>
                      </div>
                      <ValidityPill expiresAt={training.expiresAt} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <footer className="flex flex-col gap-1.5 border-t border-slate-100 px-5 py-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /> Verificado pela plataforma CHECK-ON</span>
              <span>Consulta em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(badge.verifiedAt))}</span>
            </footer>
          </article>
        )}

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          Esta página confirma os dados apresentados no crachá. Para correções, contate a empresa responsável.
        </p>
      </div>
    </main>
  );
}
