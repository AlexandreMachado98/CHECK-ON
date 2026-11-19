/**
 * Assinatura da empresa no CHECK-ON (controlada pelo DDS Master).
 *
 *   ATIVA / TESTE ──(passou o vencimento)──► CARENCIA ──(fim da carência)──► VENCIDA
 *   SUSPENSA: bloqueada à mão no Master (Tenant.isActive = false).
 *
 * Na carência tudo funciona e o portal mostra um aviso; vencida, o login no portal e no app é recusado.
 * Nada é apagado: renovou, volta a funcionar na hora.
 */

export const BILLING_CYCLES = ['TESTE', 'MENSAL', 'ANUAL'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export type SubscriptionState = 'ATIVA' | 'TESTE' | 'CARENCIA' | 'VENCIDA' | 'SUSPENSA';

export type SubscriptionFields = {
  isActive: boolean;
  billingCycle?: string | null;
  subscriptionEndsAt?: Date | null;
  graceDays?: number | null;
};

export type SubscriptionInfo = {
  state: SubscriptionState;
  billingCycle: string;
  endsAt: string | null;
  graceEndsAt: string | null;
  /** Dias até o vencimento (negativo depois dele). Sem vencimento: null. */
  daysLeft: number | null;
  /** Login e acessos recusados. */
  blocksAccess: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3, sem horário de verão desde 2019

/** Número do dia no calendário de Brasília. */
function brasiliaDay(date: Date): number {
  return Math.floor((date.getTime() - BRASILIA_OFFSET_MS) / DAY_MS);
}

export const SUBSCRIPTION_EXPIRED_MESSAGE =
  'A assinatura do CHECK-ON da sua empresa venceu. Fale com o responsável pela empresa para renovar.';

export function subscriptionInfo(tenant: SubscriptionFields, now: Date = new Date()): SubscriptionInfo {
  const billingCycle = tenant.billingCycle || 'MENSAL';
  const endsAt = tenant.subscriptionEndsAt ?? null;
  const graceDays = Math.max(0, tenant.graceDays ?? 0);
  const graceEndsAt = endsAt ? new Date(endsAt.getTime() + graceDays * DAY_MS) : null;
  // Dias de calendário em Brasília: no dia do vencimento é 0 ("vence hoje"), na véspera é 1.
  const daysLeft = endsAt ? brasiliaDay(endsAt) - brasiliaDay(now) : null;

  let state: SubscriptionState;
  if (!tenant.isActive) state = 'SUSPENSA';
  else if (!endsAt || now.getTime() <= endsAt.getTime()) state = billingCycle === 'TESTE' ? 'TESTE' : 'ATIVA';
  else if (graceEndsAt && now.getTime() <= graceEndsAt.getTime()) state = 'CARENCIA';
  else state = 'VENCIDA';

  return {
    state,
    billingCycle,
    endsAt: endsAt?.toISOString() ?? null,
    graceEndsAt: graceEndsAt?.toISOString() ?? null,
    daysLeft,
    blocksAccess: state === 'VENCIDA' || state === 'SUSPENSA',
  };
}

/** Só o vencimento (sem olhar a suspensão manual, que já tem a sua própria mensagem). */
export function subscriptionExpired(tenant: Omit<SubscriptionFields, 'isActive'>, now: Date = new Date()): boolean {
  return subscriptionInfo({ ...tenant, isActive: true }, now).state === 'VENCIDA';
}

/**
 * "2026-12-19" → fim daquele dia no horário de Brasília (o cliente usa até o fim do dia do vencimento).
 * Aceita também data e hora completas (ISO 8601).
 */
export function endOfDayBrasilia(value: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999-03:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida.');
  return date;
}

/** Soma meses a partir de uma data, terminando no fim do dia (Brasília). Ex.: 19/11 + 1 mês → 19/12 23:59. */
export function addMonthsEndOfDay(from: Date, months: number): Date {
  // Data no fuso de Brasília (UTC-3, sem horário de verão desde 2019).
  const local = new Date(from.getTime() - 3 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(local.getUTCDate(), lastDay);
  const target = new Date(Date.UTC(year, month, day));
  return endOfDayBrasilia(target.toISOString().slice(0, 10));
}

/** Soma dias a partir de hoje, terminando no fim do dia (Brasília). */
export function addDaysEndOfDay(from: Date, days: number): Date {
  const local = new Date(from.getTime() - 3 * 60 * 60 * 1000 + days * DAY_MS);
  return endOfDayBrasilia(local.toISOString().slice(0, 10));
}
