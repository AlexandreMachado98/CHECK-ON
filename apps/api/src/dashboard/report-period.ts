import { BadRequestException } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { startOfDayInTimeZone } from './time-zone';

/** Períodos da tela de Relatórios, em dias (contando hoje). "all" = todo o histórico. */
export const REPORT_PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 } as const;
export type ReportPeriod = keyof typeof REPORT_PERIOD_DAYS | 'all';
export const REPORT_PERIODS: ReportPeriod[] = [...(Object.keys(REPORT_PERIOD_DAYS) as ReportPeriod[]), 'all'];
/** Padrão: os últimos 30 dias. Todo o histórico fica cada vez mais pesado com os anos de uso. */
export const DEFAULT_REPORT_PERIOD: ReportPeriod = '30d';
/** Datas escolhidas: no máximo ~3 anos de uma vez. */
export const MAX_CUSTOM_DAYS = 3 * 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ReportQueryDto {
  @IsOptional()
  @IsIn(REPORT_PERIODS, { message: `Período inválido. Use ${REPORT_PERIODS.join(', ')}.` })
  period?: ReportPeriod;

  /** Datas escolhidas (dia inteiro, no fuso da empresa): de ... até ..., inclusive. Têm prioridade sobre `period`. */
  @IsOptional()
  @Matches(ISO_DATE, { message: 'Data inicial inválida. Use AAAA-MM-DD.' })
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE, { message: 'Data final inválida. Use AAAA-MM-DD.' })
  to?: string;

  /** Só uma frente de trabalho (dentro das que a pessoa pode ver). */
  @IsOptional()
  @IsUUID('all', { message: 'Frente de trabalho inválida.' })
  unitId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meia-noite do dia `date` + `days` no fuso (vai pelo meio-dia: funciona com horário de verão). */
function shiftDays(startOfDay: Date, days: number, timeZone: string): Date {
  return startOfDayInTimeZone(new Date(startOfDay.getTime() + days * DAY_MS + DAY_MS / 2), timeZone);
}

/** Meia-noite (no fuso) do dia AAAA-MM-DD. */
function dayStart(isoDate: string, timeZone: string): Date {
  const noonUtc = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(noonUtc.getTime()) || noonUtc.toISOString().slice(0, 10) !== isoDate) {
    throw new BadRequestException(`Data inexistente: ${isoDate}.`);
  }
  return startOfDayInTimeZone(noonUtc, timeZone);
}

/**
 * Início do período: meia-noite (no fuso da empresa) de N-1 dias atrás, para "7 dias" incluir hoje
 * e os 6 dias anteriores, como o resumo do painel. `null` = sem limite (todo o histórico).
 */
export function reportPeriodStart(period: ReportPeriod, now: Date, timeZone: string): Date | null {
  if (period === 'all') return null;
  return shiftDays(startOfDayInTimeZone(now, timeZone), -(REPORT_PERIOD_DAYS[period] - 1), timeZone);
}

export interface ReportRange {
  key: ReportPeriod | 'custom';
  /** Início (inclusive); null = desde sempre. */
  from: Date | null;
  /** Fim (exclusivo); null = até agora. */
  to: Date | null;
  /** Mesmo número de dias imediatamente antes, para comparar; null em "todo o histórico". */
  previous: { from: Date; to: Date } | null;
}

/** Período do relatório a partir da consulta: datas escolhidas ou um dos períodos prontos. */
export function resolveReportRange(query: ReportQueryDto, now: Date, timeZone: string): ReportRange {
  if (query.from || query.to) {
    if (!query.from || !query.to) throw new BadRequestException('Informe a data inicial e a final.');
    const from = dayStart(query.from, timeZone);
    const lastDay = dayStart(query.to, timeZone);
    if (lastDay < from) throw new BadRequestException('A data final é anterior à inicial.');
    const days = Math.round((lastDay.getTime() - from.getTime()) / DAY_MS) + 1;
    if (days > MAX_CUSTOM_DAYS) throw new BadRequestException('Escolha no máximo 3 anos de uma vez.');
    const to = shiftDays(lastDay, 1, timeZone);
    return { key: 'custom', from, to, previous: { from: shiftDays(from, -days, timeZone), to: from } };
  }
  const key = query.period ?? DEFAULT_REPORT_PERIOD;
  const from = reportPeriodStart(key, now, timeZone);
  if (!from || key === 'all') return { key, from: null, to: null, previous: null };
  return { key, from, to: null, previous: { from: shiftDays(from, -REPORT_PERIOD_DAYS[key], timeZone), to: from } };
}
