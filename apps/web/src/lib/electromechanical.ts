import type { EmState, EmStatus } from './types';

/** "10/03/2027" a partir de AAAA-MM-DD (sem passar pelo fuso). */
export function dayBr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export const EM_STATE: Record<EmState, { label: string; badge: string }> = {
  VENCIDA: { label: 'Vencida', badge: 'border-rose-200 bg-rose-50 text-rose-800' },
  LIBERADA: { label: 'Liberada provisoriamente', badge: 'border-amber-200 bg-amber-50 text-amber-900' },
  VENCE_EM_BREVE: { label: 'Vence em breve', badge: 'border-amber-200 bg-amber-50 text-amber-900' },
  EM_DIA: { label: 'Em dia', badge: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  SEM_REGISTRO: { label: 'Sem registro', badge: 'border-slate-200 bg-white text-slate-600' },
};

/** Texto curto do selo: "Eletromec. vencida", "Vence em 8 dias", "Válida até 10/03/2027". */
export function emShortText(em: EmStatus): string {
  switch (em.state) {
    case 'VENCIDA': return `Eletromecânica vencida em ${dayBr(em.expiresAt)}`;
    case 'LIBERADA': return `Liberado até ${dayBr(em.releasedUntil)} (eletromec. vencida)`;
    case 'VENCE_EM_BREVE': return em.daysLeft === 0 ? 'Eletromecânica vence hoje' : `Eletromecânica vence em ${em.daysLeft} ${em.daysLeft === 1 ? 'dia' : 'dias'}`;
    case 'EM_DIA': return `Eletromecânica até ${dayBr(em.expiresAt)}`;
    default: return 'Sem eletromecânica registrada';
  }
}

/** AAAA-MM-DD de hoje no navegador e somas de dias/meses (datas do laudo, sem hora). */
export function localIsoToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  // 31/01 + 1 mês: fica no último dia de fevereiro, não em março.
  if (date.getUTCDate() !== d) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
