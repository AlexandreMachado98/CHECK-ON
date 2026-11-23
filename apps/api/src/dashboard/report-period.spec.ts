import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { REPORT_PERIODS, ReportQueryDto, reportPeriodStart, resolveReportRange } from './report-period';

const SP = 'America/Sao_Paulo';

describe('Período da tela de Relatórios', () => {
  // 23/11/2026 às 10:00 em São Paulo (13:00 UTC).
  const now = new Date('2026-11-23T13:00:00Z');

  it('"7 dias" começa à meia-noite (horário de São Paulo) de 6 dias atrás: hoje + 6 anteriores', () => {
    expect(reportPeriodStart('7d', now, SP)?.toISOString()).toBe('2026-11-17T03:00:00.000Z');
  });

  it('30 dias, 90 dias e 12 meses', () => {
    expect(reportPeriodStart('30d', now, SP)?.toISOString()).toBe('2026-10-25T03:00:00.000Z');
    expect(reportPeriodStart('90d', now, SP)?.toISOString()).toBe('2026-08-26T03:00:00.000Z');
    expect(reportPeriodStart('12m', now, SP)?.toISOString()).toBe('2025-11-24T03:00:00.000Z');
  });

  it('"tudo" não tem limite', () => {
    expect(reportPeriodStart('all', now, SP)).toBeNull();
  });

  it('logo depois da meia-noite local o dia já é o novo (servidor em UTC)', () => {
    // 00:30 de 24/11 em São Paulo = 03:30 UTC
    expect(reportPeriodStart('7d', new Date('2026-11-24T03:30:00Z'), SP)?.toISOString()).toBe('2026-11-18T03:00:00.000Z');
  });

  it('fuso com horário de verão: sempre cai na meia-noite local', () => {
    // Nova York: 08/03/2026 começa o horário de verão; 30 dias antes de 20/03 cruza a troca.
    const start = reportPeriodStart('30d', new Date('2026-03-20T16:00:00Z'), 'America/New_York');
    expect(start?.toISOString()).toBe('2026-02-19T05:00:00.000Z');
  });

  it('a rota aceita só os períodos conhecidos', async () => {
    for (const period of REPORT_PERIODS) expect(await validate(plainToInstance(ReportQueryDto, { period }))).toHaveLength(0);
    expect(await validate(plainToInstance(ReportQueryDto, {}))).toHaveLength(0);
    const [error] = await validate(plainToInstance(ReportQueryDto, { period: '5y' }));
    expect(error.constraints?.isIn).toContain('Período inválido');
  });

  it('datas escolhidas: do início do 1º dia ao fim do último, no horário de São Paulo, e o anterior do mesmo tamanho', () => {
    const range = resolveReportRange({ from: '2026-10-01', to: '2026-10-31' }, now, SP);
    expect(range.key).toBe('custom');
    expect(range.from?.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-11-01T03:00:00.000Z'); // fim exclusivo: 31/10 inteiro
    expect(range.previous?.from.toISOString()).toBe('2026-08-31T03:00:00.000Z'); // 31 dias antes
    expect(range.previous?.to.toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });

  it('um dia só (de = até)', () => {
    const range = resolveReportRange({ from: '2026-11-20', to: '2026-11-20' }, now, SP);
    expect(range.to!.getTime() - range.from!.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(range.previous?.from.toISOString()).toBe('2026-11-19T03:00:00.000Z');
  });

  it('período pronto: até agora, e o anterior com o mesmo número de dias', () => {
    const range = resolveReportRange({ period: '7d' }, now, SP);
    expect(range.from?.toISOString()).toBe('2026-11-17T03:00:00.000Z');
    expect(range.to).toBeNull();
    expect(range.previous).toEqual({ from: new Date('2026-11-10T03:00:00.000Z'), to: new Date('2026-11-17T03:00:00.000Z') });
    expect(resolveReportRange({}, now, SP).key).toBe('30d');
    expect(resolveReportRange({ period: 'all' }, now, SP)).toEqual({ key: 'all', from: null, to: null, previous: null });
  });

  it('recusa datas incompletas, invertidas, inexistentes ou longas demais', () => {
    expect(() => resolveReportRange({ from: '2026-10-01' }, now, SP)).toThrow('data inicial e a final');
    expect(() => resolveReportRange({ from: '2026-10-31', to: '2026-10-01' }, now, SP)).toThrow('anterior à inicial');
    expect(() => resolveReportRange({ from: '2026-02-30', to: '2026-03-01' }, now, SP)).toThrow('inexistente');
    expect(() => resolveReportRange({ from: '2020-01-01', to: '2026-01-01' }, now, SP)).toThrow('3 anos');
  });

  it('a rota valida o formato das datas e da frente', async () => {
    expect(await validate(plainToInstance(ReportQueryDto, { from: '2026-10-01', to: '2026-10-31', unitId: '5f72213e-6964-41ff-8c2c-2231facd6d94' }))).toHaveLength(0);
    expect((await validate(plainToInstance(ReportQueryDto, { from: '01/10/2026' })))[0].constraints?.matches).toContain('AAAA-MM-DD');
    expect((await validate(plainToInstance(ReportQueryDto, { unitId: 'frente-1' })))[0].constraints?.isUuid).toContain('Frente');
  });
});
