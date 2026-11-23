import { describe, expect, it, vi } from 'vitest';
import { NcService } from './nc.service';

/** Banco simulado: NCs ativas por gravidade (mais novas primeiro dentro de cada uma). */
function buildService(bySeverity: Record<string, string[]>) {
  const rows = (severity: string) => (bySeverity[severity] ?? []).map((id) => ({ id, severity, item: null, answer: null }));
  const nonConformity = {
    findMany: vi.fn().mockImplementation(({ where, skip = 0, take }) => Promise.resolve(rows(where.severity).slice(skip, skip + take))),
    count: vi.fn().mockImplementation(({ where }) => Promise.resolve(where?.severity && typeof where.severity === 'string' ? rows(where.severity).length : 0)),
  };
  const prisma = { nonConformity, checklistAnswer: { groupBy: vi.fn().mockResolvedValue([]) } };
  return { service: new NcService(prisma as never, {} as never, {} as never), nonConformity };
}

describe('Lista de NCs: mais graves primeiro (painel)', () => {
  const data = { CRITICAL: ['c1'], HIGH: [], MEDIUM: ['m1', 'm2', 'm3', 'm4', 'm5'], LOW: ['l1'] };

  it('as 3 mais graves: a crítica e depois as médias mais novas, sem baixar o resto', async () => {
    const { service, nonConformity } = buildService(data);
    const page = await service.findPage({ status: 'ACTIVE', sort: 'severity', page: 1, pageSize: 3 });
    expect(page.items.map((nc) => nc.id)).toEqual(['c1', 'm1', 'm2']);
    // Parou nas médias: não consultou as baixas.
    expect(nonConformity.findMany.mock.calls.map((c) => c[0].where.severity)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM']);
    expect(nonConformity.findMany.mock.calls[0][0].take).toBe(3);
  });

  it('2ª página continua de onde a 1ª parou, atravessando as gravidades', async () => {
    const { service } = buildService(data);
    const page = await service.findPage({ status: 'ACTIVE', sort: 'severity', page: 2, pageSize: 3 });
    expect(page.items.map((nc) => nc.id)).toEqual(['m3', 'm4', 'm5']);
  });

  it('com filtro de gravidade, só consulta aquela', async () => {
    const { service, nonConformity } = buildService(data);
    const page = await service.findPage({ status: 'ACTIVE', sort: 'severity', severity: 'LOW', page: 1, pageSize: 3 });
    expect(page.items.map((nc) => nc.id)).toEqual(['l1']);
    expect(nonConformity.findMany.mock.calls.map((c) => c[0].where.severity)).toEqual(['LOW']);
  });

  it('sem "sort", continua a ordem de sempre (mais novas primeiro)', async () => {
    const { service, nonConformity } = buildService(data);
    await service.findPage({ status: 'ACTIVE', page: 1, pageSize: 50 });
    expect(nonConformity.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
    expect(nonConformity.findMany.mock.calls[0][0].include.answer.select.photoUrl).toBe(true);
    expect(nonConformity.findMany.mock.calls[0][0].include.vehicle).toEqual({ select: { id: true, plate: true, model: true, status: true } });
  });
});
