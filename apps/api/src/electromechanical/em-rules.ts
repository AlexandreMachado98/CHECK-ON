import { Prisma } from '@prisma/client';
import { dashboardTimeZone } from '../dashboard/time-zone';

/** Situação da inspeção eletromecânica do veículo. */
export type EmState = 'SEM_REGISTRO' | 'EM_DIA' | 'VENCE_EM_BREVE' | 'VENCIDA' | 'LIBERADA';

/** A partir de quantos dias antes do vencimento a inspeção aparece como "vence em breve". */
export const EM_WARN_DAYS = 15;
/** Liberação provisória de veículo vencido: no máximo estes dias. */
export const EM_RELEASE_MAX_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/** Data de hoje (AAAA-MM-DD) no fuso do painel. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: dashboardTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Campo DATE do banco (vem como meia-noite UTC) em AAAA-MM-DD. */
export function isoDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function addDaysIso(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export type EmStatus = {
  state: EmState;
  expiresAt: string | null;
  /** Dias até vencer (negativo: vencida há tantos dias). */
  daysLeft: number | null;
  releasedUntil: string | null;
};

/**
 * Situação da eletromecânica. A validade vale até o fim do dia escrito no laudo: o bloqueio começa no
 * dia seguinte. Veículo sem nenhuma inspeção registrada não é bloqueado (a empresa pode estar
 * começando a usar o controle); aparece como "sem registro".
 */
export function emStatus(expiresAt: Date | null | undefined, releasedUntil: Date | null | undefined, today = todayIso()): EmStatus {
  const exp = isoDay(expiresAt);
  const rel = isoDay(releasedUntil);
  if (!exp) return { state: 'SEM_REGISTRO', expiresAt: null, daysLeft: null, releasedUntil: null };
  const daysLeft = daysBetween(today, exp);
  if (daysLeft < 0) {
    const released = !!rel && rel >= today;
    return { state: released ? 'LIBERADA' : 'VENCIDA', expiresAt: exp, daysLeft, releasedUntil: released ? rel : null };
  }
  return { state: daysLeft <= EM_WARN_DAYS ? 'VENCE_EM_BREVE' : 'EM_DIA', expiresAt: exp, daysLeft, releasedUntil: null };
}

/** Situação mostrada do veículo: a das NCs/manual, ou Bloqueado se a eletromecânica venceu sem liberação. */
export function effectiveVehicleStatus(status: string, em: EmStatus): string {
  return em.state === 'VENCIDA' ? 'BLOQUEADO' : status;
}

/**
 * Condição SQL "bloqueado pela eletromecânica" para consultas escritas à mão (painel e relatório).
 * `alias` é SQL confiável do código (ex.: 'v' ou '"Vehicle"').
 */
export function sqlEmBlocked(alias: string, today = todayIso()): Prisma.Sql {
  const a = Prisma.raw(alias);
  // "IS NOT NULL" primeiro: sem validade registrada a condição é falsa (e não NULL, que num NOT
  // tiraria o veículo das contagens de liberados e em atenção).
  return Prisma.sql`(${a}."emExpiresAt" IS NOT NULL AND ${a}."emExpiresAt" < ${today}::date AND (${a}."emReleasedUntil" IS NULL OR ${a}."emReleasedUntil" < ${today}::date))`;
}
