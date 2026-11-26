import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

function service() {
  const prisma = {
    drivingFeedback: {
      aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 3.666 }, _count: { _all: 3 } }),
      count: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.status === 'TRATADA' ? 1 : 2)),
    },
    suggestion: {
      findMany: vi.fn().mockResolvedValue([
        { status: 'RESOLVIDA', prioritizedAt: new Date('2026-11-02'), dueDate: new Date('2026-11-10'), resolvedAt: new Date('2026-11-09'), rating: 4 },
        { status: 'PRIORIZADA', prioritizedAt: new Date('2026-11-03'), dueDate: null, resolvedAt: null, rating: null },
        { status: 'RECEBIDA', prioritizedAt: null, dueDate: null, resolvedAt: null, rating: null },
        { status: 'ARQUIVADA', prioritizedAt: null, dueDate: null, resolvedAt: null, rating: null },
      ]),
    },
  };
  return { dashboard: new DashboardService(prisma as never, { get: () => 't1' } as never), prisma };
}

describe('Relatório — canais do passageiro', () => {
  it('avaliações de direção e sugestões do período, com a nota da empresa só das priorizadas', async () => {
    const { dashboard } = service();
    const from = new Date('2026-11-01T03:00:00Z');
    const to = new Date('2026-12-01T03:00:00Z');
    const res = await (dashboard as unknown as { passengerTotals: (f: Date | null, t: Date | null, u: string | null) => Promise<unknown> }).passengerTotals(from, to, null);
    expect(res).toEqual({
      driving: { count: 3, average: 3.7, alerts: 2, alertsTreated: 1 },
      suggestions: { received: 4, archived: 1, prioritized: 2, resolved: 1, open: 1, withDue: 1, onTime: 1, rated: 1, average: 4 },
    });
  });

  it('filtro de frente: avaliações pela frota do veículo, sugestões pela frente gravada', async () => {
    const { dashboard, prisma } = service();
    await (dashboard as unknown as { passengerTotals: (f: Date | null, t: Date | null, u: string | null) => Promise<unknown> }).passengerTotals(null, null, 'u1');
    expect(prisma.drivingFeedback.aggregate.mock.calls[0][0].where).toEqual({ vehicle: { fleet: { unitId: 'u1' } } });
    expect(prisma.suggestion.findMany.mock.calls[0][0].where).toEqual({ unitId: 'u1' });
  });
});
