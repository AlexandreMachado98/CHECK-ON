import { describe, expect, it } from 'vitest';
import { addDaysEndOfDay, addMonthsEndOfDay, endOfDayBrasilia, subscriptionExpired, subscriptionInfo } from './subscription';

const at = (iso: string) => new Date(iso);

describe('subscriptionInfo', () => {
  const endsAt = endOfDayBrasilia('2026-12-19'); // 2026-12-20T02:59:59.999Z

  it('sem vencimento: ativa e sem bloqueio (empresas antigas)', () => {
    const info = subscriptionInfo({ isActive: true }, at('2030-01-01T00:00:00Z'));
    expect(info).toMatchObject({ state: 'ATIVA', endsAt: null, daysLeft: null, blocksAccess: false });
  });

  it('antes do vencimento: ativa (ou teste) com dias restantes', () => {
    expect(subscriptionInfo({ isActive: true, subscriptionEndsAt: endsAt, graceDays: 5 }, at('2026-12-12T12:00:00Z'))).toMatchObject({
      state: 'ATIVA',
      daysLeft: 7,
      blocksAccess: false,
    });
    expect(subscriptionInfo({ isActive: true, billingCycle: 'TESTE', subscriptionEndsAt: endsAt }, at('2026-12-12T12:00:00Z')).state).toBe('TESTE');
  });

  it('conta dias de calendário: véspera = 1, dia do vencimento = 0, dia seguinte = -1', () => {
    const at2 = (iso: string) => subscriptionInfo({ isActive: true, subscriptionEndsAt: endsAt, graceDays: 5 }, at(iso)).daysLeft;
    expect(at2('2026-12-19T02:00:00Z')).toBe(1); // 18/12 23:00 em Brasília
    expect(at2('2026-12-19T03:30:00Z')).toBe(0); // 19/12 00:30
    expect(at2('2026-12-20T02:00:00Z')).toBe(0); // 19/12 23:00
    expect(at2('2026-12-20T04:00:00Z')).toBe(-1); // 20/12 01:00
  });

  it('vale até o fim do dia do vencimento no horário de Brasília', () => {
    // 19/12 às 23:30 em Brasília = 20/12 02:30 UTC
    expect(subscriptionInfo({ isActive: true, subscriptionEndsAt: endsAt, graceDays: 0 }, at('2026-12-20T02:30:00Z')).state).toBe('ATIVA');
    expect(subscriptionInfo({ isActive: true, subscriptionEndsAt: endsAt, graceDays: 0 }, at('2026-12-20T03:00:01Z')).state).toBe('VENCIDA');
  });

  it('depois do vencimento: carência e depois vencida (bloqueia)', () => {
    const carencia = subscriptionInfo({ isActive: true, subscriptionEndsAt: endsAt, graceDays: 5 }, at('2026-12-22T12:00:00Z'));
    expect(carencia).toMatchObject({ state: 'CARENCIA', blocksAccess: false });
    expect(carencia.daysLeft).toBeLessThan(0);
    expect(carencia.graceEndsAt).toBe('2026-12-25T02:59:59.999Z');
    expect(subscriptionInfo({ isActive: true, subscriptionEndsAt: endsAt, graceDays: 5 }, at('2026-12-26T12:00:00Z'))).toMatchObject({
      state: 'VENCIDA',
      blocksAccess: true,
    });
  });

  it('suspensa à mão vence qualquer data', () => {
    expect(subscriptionInfo({ isActive: false, subscriptionEndsAt: endsAt }, at('2026-12-01T00:00:00Z'))).toMatchObject({
      state: 'SUSPENSA',
      blocksAccess: true,
    });
  });

  it('subscriptionExpired ignora a suspensão manual', () => {
    expect(subscriptionExpired({ subscriptionEndsAt: endsAt, graceDays: 0 }, at('2027-01-01T00:00:00Z'))).toBe(true);
    expect(subscriptionExpired({ subscriptionEndsAt: null }, at('2027-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('datas de vencimento', () => {
  it('soma meses mantendo o dia (e ajusta fim de mês)', () => {
    expect(addMonthsEndOfDay(at('2026-11-19T15:00:00Z'), 1).toISOString()).toBe('2026-12-20T02:59:59.999Z');
    expect(addMonthsEndOfDay(at('2026-11-19T15:00:00Z'), 12).toISOString()).toBe('2027-11-20T02:59:59.999Z');
    expect(addMonthsEndOfDay(at('2027-01-31T15:00:00Z'), 1).toISOString()).toBe('2027-03-01T02:59:59.999Z'); // 28/02
  });

  it('usa a data de Brasília perto da meia-noite', () => {
    // 20/11 01:00 UTC ainda é 19/11 em Brasília
    expect(addDaysEndOfDay(at('2026-11-20T01:00:00Z'), 15).toISOString()).toBe('2026-12-05T02:59:59.999Z');
  });

  it('recusa data inválida', () => {
    expect(() => endOfDayBrasilia('2026-13-45')).toThrow();
  });
});
