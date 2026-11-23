import { IsIn, IsOptional } from 'class-validator';
import { startOfDayInTimeZone } from './time-zone';

/** Períodos da tela de Relatórios, em dias (contando hoje). "all" = todo o histórico. */
export const REPORT_PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 } as const;
export type ReportPeriod = keyof typeof REPORT_PERIOD_DAYS | 'all';
export const REPORT_PERIODS: ReportPeriod[] = [...(Object.keys(REPORT_PERIOD_DAYS) as ReportPeriod[]), 'all'];
/** Padrão: os últimos 30 dias. Todo o histórico fica cada vez mais pesado com os anos de uso. */
export const DEFAULT_REPORT_PERIOD: ReportPeriod = '30d';

export class ReportQueryDto {
  @IsOptional()
  @IsIn(REPORT_PERIODS, { message: `Período inválido. Use ${REPORT_PERIODS.join(', ')}.` })
  period?: ReportPeriod;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Início do período: meia-noite (no fuso da empresa) de N-1 dias atrás, para "7 dias" incluir hoje
 * e os 6 dias anteriores, como o resumo do painel. `null` = sem limite (todo o histórico).
 */
export function reportPeriodStart(period: ReportPeriod, now: Date, timeZone: string): Date | null {
  if (period === 'all') return null;
  const startOfToday = startOfDayInTimeZone(now, timeZone);
  // Meia-noite de N-1 dias atrás: volta ao meio-dia desse dia e pega o início dele no fuso
  // (funciona mesmo com troca de horário de verão no meio do caminho).
  const target = new Date(startOfToday.getTime() - (REPORT_PERIOD_DAYS[period] - 1) * DAY_MS + DAY_MS / 2);
  return startOfDayInTimeZone(target, timeZone);
}
