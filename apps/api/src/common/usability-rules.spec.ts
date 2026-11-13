import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import { vehicleStatusFromActiveNcs } from '../checklist/checklist-rules';
import { PLATE_PATTERN, normalizePlate } from '../vehicle/plate';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('bloqueio automático por NC crítica (configuração da empresa)', () => {
  it('ligado (padrão): NC crítica bloqueia', () => {
    expect(vehicleStatusFromActiveNcs(['CRITICAL'])).toBe('BLOQUEADO');
    expect(vehicleStatusFromActiveNcs(['CRITICAL'], true)).toBe('BLOQUEADO');
  });
  it('desligado: NC crítica deixa em atenção', () => {
    expect(vehicleStatusFromActiveNcs(['CRITICAL', 'LOW'], false)).toBe('ATENCAO');
  });
  it('sem NC ativa continua liberado', () => {
    expect(vehicleStatusFromActiveNcs([], false)).toBe('LIBERADO');
  });
});

describe('placa', () => {
  it('normaliza hífen, espaço e minúsculas', () => {
    expect(normalizePlate(' abc-1d23 ')).toBe('ABC1D23');
  });
  it('aceita padrão antigo e Mercosul, recusa o resto', () => {
    expect(PLATE_PATTERN.test('ABC1234')).toBe(true);
    expect(PLATE_PATTERN.test('ABC1D23')).toBe(true);
    expect(PLATE_PATTERN.test('AB12345')).toBe(false);
    expect(PLATE_PATTERN.test('TST')).toBe(false);
  });
});

describe('PrismaExceptionFilter', () => {
  function run(code: string, meta?: Record<string, unknown>) {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never;
    new PrismaExceptionFilter().catch(new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5', meta }), host);
    return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
  }
  it('valor duplicado vira 409 com o nome do campo, sem citar tenantId', () => {
    const r = run('P2002', { target: ['tenantId', 'plate'] });
    expect(r.status).toBe(HttpStatus.CONFLICT);
    expect(r.body.message).toBe('Já existe um cadastro com esta placa.');
  });
  it('registro inexistente vira 404', () => {
    expect(run('P2025').status).toBe(HttpStatus.NOT_FOUND);
  });
});

import { containsPattern, normalizeTerm } from './search-sql';
describe('busca sem acento', () => {
  it('normaliza acento e maiúsculas', () => {
    expect(normalizeTerm('  João ')).toBe('joao');
  });
  it('trata % e _ digitados como texto', () => {
    expect(containsPattern('50%_x')).toBe('%50\\%\\_x%');
  });
});
