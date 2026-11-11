import { describe, expect, it } from 'vitest';
import { startOfDayInTimeZone } from './time-zone';

describe('startOfDayInTimeZone', () => {
  it('usa o dia de São Paulo, não o do UTC', () => {
    // 22h30 em São Paulo do dia 10 = 01h30 UTC do dia 11
    const result = startOfDayInTimeZone(new Date('2026-11-11T01:30:00Z'), 'America/Sao_Paulo');
    expect(result.toISOString()).toBe('2026-11-10T03:00:00.000Z');
  });

  it('meia-noite exata continua no mesmo dia', () => {
    const result = startOfDayInTimeZone(new Date('2026-11-10T03:00:00Z'), 'America/Sao_Paulo');
    expect(result.toISOString()).toBe('2026-11-10T03:00:00.000Z');
  });

  it('UTC devolve a meia-noite UTC', () => {
    const result = startOfDayInTimeZone(new Date('2026-11-11T15:00:00Z'), 'UTC');
    expect(result.toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });

  it('respeita o horário de verão de outros fusos', () => {
    // Nova York, 8 de março de 2026 (dia da mudança): meia-noite local ainda é EST (UTC-5)
    const result = startOfDayInTimeZone(new Date('2026-03-08T18:00:00Z'), 'America/New_York');
    expect(result.toISOString()).toBe('2026-03-08T05:00:00.000Z');
  });
});
