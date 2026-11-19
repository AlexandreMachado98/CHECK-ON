import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MasterTokenGuard, resetMasterGuardFailures } from './master-token.guard';

const TOKEN = 'k'.repeat(40);

function context(authorization?: string, ip = '1.1.1.1') {
  const request = { ip, get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('MasterTokenGuard', () => {
  const guard = new MasterTokenGuard();
  beforeEach(() => {
    process.env.CHECKON_MASTER_TOKEN = TOKEN;
    resetMasterGuardFailures();
  });
  afterEach(() => {
    delete process.env.CHECKON_MASTER_TOKEN;
  });

  it('chave certa: libera', () => {
    expect(guard.canActivate(context(`Bearer ${TOKEN}`))).toBe(true);
  });
  it('sem chave, chave errada ou outro esquema: recusa', () => {
    expect(() => guard.canActivate(context())).toThrow('Chave de integração inválida');
    expect(() => guard.canActivate(context('Bearer errada'))).toThrow('Chave de integração inválida');
    expect(() => guard.canActivate(context(`Basic ${TOKEN}`))).toThrow('Chave de integração inválida');
  });
  it('sem a variável (ou curta demais): integração desligada', () => {
    delete process.env.CHECKON_MASTER_TOKEN;
    expect(() => guard.canActivate(context(`Bearer ${TOKEN}`))).toThrow('não está configurada');
    process.env.CHECKON_MASTER_TOKEN = 'curta';
    expect(() => guard.canActivate(context('Bearer curta'))).toThrow('não está configurada');
  });
  it('10 chaves erradas seguidas bloqueiam o IP, mesmo com a chave certa depois', () => {
    for (let i = 0; i < 10; i++) expect(() => guard.canActivate(context('Bearer errada', '9.9.9.9'))).toThrow('inválida');
    expect(() => guard.canActivate(context(`Bearer ${TOKEN}`, '9.9.9.9'))).toThrow('Muitas tentativas');
    expect(guard.canActivate(context(`Bearer ${TOKEN}`, '8.8.8.8'))).toBe(true);
  });
});
