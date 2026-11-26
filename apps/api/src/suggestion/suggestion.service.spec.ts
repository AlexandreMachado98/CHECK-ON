import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { SuggestionService } from './suggestion.service';
import { newProtocol, suggestionScore } from './suggestion-rules';

const TOKEN = 'b'.repeat(32);
const FOLLOW = 'c'.repeat(32);
const vehicle = { id: 'v1', tenantId: 't1', plate: 'ABC1D23', prefix: 'P-1', model: null, fleet: { unitId: 'frente-porto' }, tenant: { name: 'Transportes Sul' } };

function service({ deviceToday = 0, existing = null as unknown, createErrors = 0, ratedCount = 1 } = {}) {
  let fails = createErrors;
  const prisma = {
    vehicle: { findFirst: vi.fn().mockResolvedValue(vehicle) },
    suggestion: {
      count: vi.fn().mockResolvedValue(deviceToday),
      create: vi.fn(({ data }) => (fails-- > 0 ? Promise.reject({ code: 'P2002' }) : Promise.resolve({ protocol: data.protocol, followToken: data.followToken }))),
      findFirst: vi.fn().mockResolvedValue(existing),
      update: vi.fn(({ data }) => Promise.resolve({ id: 's1', ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: ratedCount }),
    },
    user: { findFirst: vi.fn().mockResolvedValue({ name: 'Gestor Ana' }) },
    $queryRaw: vi.fn().mockResolvedValue([{ count: 0 }]),
    $executeRaw: vi.fn(),
  };
  return { suggestions: new SuggestionService(prisma as never), prisma };
}

describe('Sugestões de melhoria — passageiro', () => {
  it('grava na frente em que a placa está cadastrada e devolve protocolo e link de acompanhamento', async () => {
    const { suggestions, prisma } = service();
    const res = await suggestions.submit(TOKEN, { category: 'HORARIO', text: '  Antecipar a saída das 6h  ', deviceId: 'aparelho-1' }, '1.2.3.4');
    expect(res.protocol).toMatch(/^SG-[A-Z2-9]{6}$/);
    expect(res.followToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(prisma.suggestion.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', vehicleId: 'v1', unitId: 'frente-porto', category: 'HORARIO', text: 'Antecipar a saída das 6h' });
  });

  it('protocolo repetido na empresa: sorteia outro', async () => {
    const { suggestions, prisma } = service({ createErrors: 2 });
    await suggestions.submit(TOKEN, { category: 'OUTRO', text: 'Sugestão qualquer aqui' }, undefined);
    expect(prisma.suggestion.create).toHaveBeenCalledTimes(3);
  });

  it('limite de 5 sugestões por aparelho em 24 horas', async () => {
    const { suggestions, prisma } = service({ deviceToday: 5 });
    await expect(suggestions.submit(TOKEN, { category: 'OUTRO', text: 'Mais uma sugestão', deviceId: 'aparelho-1' }, '1.2.3.4')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.suggestion.create).not.toHaveBeenCalled();
  });

  it('nota do passageiro: só depois de resolvida e uma vez só', async () => {
    const pending = service({ existing: { id: 's1', tenantId: 't1', status: 'PRIORIZADA', tenant: { name: 'T' }, vehicle } });
    await expect(pending.suggestions.rate(FOLLOW, { rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
    const done = service({ existing: { id: 's1', tenantId: 't1', status: 'RESOLVIDA', tenant: { name: 'T' }, vehicle } });
    await expect(done.suggestions.rate(FOLLOW, { rating: 4, comment: ' ótimo ' })).resolves.toEqual({ ok: true });
    expect(done.prisma.suggestion.updateMany.mock.calls[0][0]).toMatchObject({ where: { rating: null, status: 'RESOLVIDA' }, data: { rating: 4, ratingComment: 'ótimo' } });
    const twice = service({ existing: { id: 's1', tenantId: 't1', status: 'RESOLVIDA', tenant: { name: 'T' }, vehicle }, ratedCount: 0 });
    await expect(twice.suggestions.rate(FOLLOW, { rating: 4 })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Sugestões de melhoria — gestor', () => {
  const at = (status: string, prioritizedAt: Date | null = null) => service({ existing: { id: 's1', status, prioritizedAt } });

  it('priorizar define prioridade, prazo e a data em que passou a contar na nota', async () => {
    const { suggestions } = at('RECEBIDA');
    const res = await suggestions.handle('s1', { action: 'PRIORIZAR', priority: 'ALTA', dueDate: '2026-12-10' }, { id: 'u1' });
    expect(res).toMatchObject({ status: 'PRIORIZADA', priority: 'ALTA', dueDate: new Date('2026-12-10T00:00:00Z'), handledByName: 'Gestor Ana' });
    expect(res.prioritizedAt).toBeInstanceOf(Date);
  });

  it('resolver exige priorizar antes e uma resposta ao passageiro', async () => {
    await expect(at('RECEBIDA').suggestions.handle('s1', { action: 'RESOLVER', response: 'Feito o ajuste no horário.' }, { id: 'u1' })).rejects.toThrow('Priorize a sugestão antes');
    await expect(at('EM_ANDAMENTO').suggestions.handle('s1', { action: 'RESOLVER', response: 'ok' }, { id: 'u1' })).rejects.toBeInstanceOf(BadRequestException);
    const res = await at('EM_ANDAMENTO').suggestions.handle('s1', { action: 'RESOLVER', response: 'Saída antecipada para 5h50 a partir de segunda.' }, { id: 'u1' });
    expect(res).toMatchObject({ status: 'RESOLVIDA', response: 'Saída antecipada para 5h50 a partir de segunda.' });
  });

  it('arquivar tira da nota (limpa a priorização) e exige o motivo', async () => {
    await expect(at('PRIORIZADA', new Date()).suggestions.handle('s1', { action: 'ARQUIVAR' }, { id: 'u1' })).rejects.toBeInstanceOf(BadRequestException);
    const res = await at('PRIORIZADA', new Date()).suggestions.handle('s1', { action: 'ARQUIVAR', response: 'A rota depende do contrato com o cliente.' }, { id: 'u1' });
    expect(res).toMatchObject({ status: 'ARQUIVADA', prioritizedAt: null, priority: null });
  });
});

describe('Nota da empresa', () => {
  it('conta só as priorizadas não arquivadas; nota é a média das avaliações das resolvidas', () => {
    const d = (s: string) => new Date(s);
    const score = suggestionScore([
      { status: 'RESOLVIDA', prioritizedAt: d('2026-11-01'), dueDate: d('2026-11-10'), resolvedAt: d('2026-11-10T18:00:00Z'), rating: 5 },
      { status: 'RESOLVIDA', prioritizedAt: d('2026-11-01'), dueDate: d('2026-11-05'), resolvedAt: d('2026-11-08'), rating: 2 },
      { status: 'RESOLVIDA', prioritizedAt: d('2026-11-01'), dueDate: null, resolvedAt: d('2026-11-08'), rating: null },
      { status: 'EM_ANDAMENTO', prioritizedAt: d('2026-11-01'), dueDate: null, resolvedAt: null, rating: null },
      { status: 'RECEBIDA', prioritizedAt: null, dueDate: null, resolvedAt: null, rating: null },
      { status: 'ARQUIVADA', prioritizedAt: null, dueDate: null, resolvedAt: null, rating: null },
    ]);
    expect(score).toEqual({ prioritized: 4, resolved: 3, open: 1, withDue: 2, onTime: 1, rated: 2, average: 3.5 });
    expect(suggestionScore([]).average).toBeNull();
    for (let i = 0; i < 50; i++) expect(newProtocol().slice(3)).toMatch(/^[^O0I1L]{6}$/);
  });
});
