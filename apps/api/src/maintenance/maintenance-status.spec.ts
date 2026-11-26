import { describe, expect, it } from 'vitest';
import { planStatus, worstState } from './maintenance-status';

const oil = { id: 'oleo', name: 'Troca de óleo', intervalKm: 10_000, intervalDays: 180, warnBeforeKm: 1_000 };
const now = new Date('2026-11-26T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('Situação do plano de manutenção', () => {
  it('com manutenção registrada: vence no km dela + intervalo', () => {
    const s = planStatus(oil, 55_500, { km: 50_000, performedAt: daysAgo(30) }, now);
    expect(s).toMatchObject({ dueKm: 60_000, remainingKm: 4_500, remainingDays: 150, state: 'EM_DIA', estimated: false });
  });

  it('a menos de 1.000 km fica "Próxima"; passou do km fica "Vencida"', () => {
    expect(planStatus(oil, 59_200, { km: 50_000, performedAt: daysAgo(30) }, now).state).toBe('PROXIMA');
    expect(planStatus(oil, 60_000, { km: 50_000, performedAt: daysAgo(30) }, now).state).toBe('VENCIDA');
    expect(planStatus(oil, 61_300, { km: 50_000, performedAt: daysAgo(30) }, now).remainingKm).toBe(-1_300);
  });

  it('prazo em dias: o que vencer primeiro (15 dias antes já é "Próxima")', () => {
    expect(planStatus(oil, 51_000, { km: 50_000, performedAt: daysAgo(170) }, now)).toMatchObject({ state: 'PROXIMA', remainingDays: 10 });
    expect(planStatus(oil, 51_000, { km: 50_000, performedAt: daysAgo(181) }, now).state).toBe('VENCIDA');
    // Plano só por km ignora o tempo.
    expect(planStatus({ ...oil, intervalDays: null }, 51_000, { km: 50_000, performedAt: daysAgo(400) }, now).state).toBe('EM_DIA');
  });

  it('sem manutenção registrada: estima no próximo múltiplo do intervalo e não vence por tempo', () => {
    const s = planStatus(oil, 87_300, null, now);
    expect(s).toMatchObject({ dueKm: 90_000, remainingKm: 2_700, dueDate: null, estimated: true, state: 'EM_DIA' });
    expect(planStatus(oil, 89_400, null, now).state).toBe('PROXIMA');
    // Veículo sem nenhum km informado ainda.
    expect(planStatus(oil, 0, null, now).state).toBe('SEM_KM');
  });

  it('situação do veículo é a pior entre os planos', () => {
    const ok = planStatus(oil, 55_000, { km: 50_000, performedAt: daysAgo(10) }, now);
    const late = planStatus({ ...oil, id: 'pneu', intervalKm: 40_000 }, 95_000, { km: 50_000, performedAt: daysAgo(10) }, now);
    expect(worstState([ok, late])).toBe('VENCIDA');
    expect(worstState([ok])).toBe('EM_DIA');
    expect(worstState([])).toBe('SEM_PLANO');
  });
});
