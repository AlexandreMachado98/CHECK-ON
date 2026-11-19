import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PasswordRecoveryService } from './password-recovery.service';

vi.mock('bcrypt', () => ({ hash: vi.fn().mockResolvedValue('novo-hash') }));

const account = { id: 'u1', name: 'Ana', isActive: true, tenantActive: true };

function setup(found: unknown = account) {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue(found ? [found] : []),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const neon = {
    isConfigured: vi.fn().mockReturnValue(true),
    ensureUser: vi.fn().mockResolvedValue({ ok: true }),
    sendResetCode: vi.fn().mockResolvedValue({ ok: true }),
    consumeResetCode: vi.fn().mockResolvedValue({ ok: true }),
  };
  const cache = { invalidateUser: vi.fn() };
  return { prisma, neon, cache, service: new PasswordRecoveryService(prisma as never, neon as never, cache as never) };
}

describe('Esqueci minha senha (Neon Auth)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('e-mail cadastrado: cria o espelho no Neon e envia o código', async () => {
    const { service, neon } = setup();
    const res = await service.requestCode({ email: 'ana@x.com' }, '1.1.1.1');
    expect(neon.ensureUser).toHaveBeenCalledWith('ana@x.com', 'Ana');
    expect(neon.sendResetCode).toHaveBeenCalledWith('ana@x.com');
    expect(res.message).toMatch(/Se este e-mail estiver cadastrado/);
  });

  it('e-mail inexistente: mesma resposta e nada é enviado', async () => {
    const { service, neon } = setup(null);
    const res = await service.requestCode({ email: 'ninguem@x.com' }, '1.1.1.2');
    expect(neon.sendResetCode).not.toHaveBeenCalled();
    expect(res.message).toMatch(/Se este e-mail estiver cadastrado/);
  });

  it('usuário bloqueado ou empresa desativada: não envia código', async () => {
    for (const found of [{ ...account, isActive: false }, { ...account, tenantActive: false }]) {
      const { service, neon } = setup(found);
      await service.requestCode({ email: 'ana@x.com' }, '1.1.1.3');
      expect(neon.sendResetCode).not.toHaveBeenCalled();
    }
  });

  it('código certo: troca a senha no CHECK-ON, encerra sessões e limpa o bloqueio', async () => {
    const { service, prisma, cache, neon } = setup();
    const res = await service.resetWithCode({ email: 'ana@x.com', code: '123456', newPassword: 'novaSenha1' });
    expect(neon.consumeResetCode).toHaveBeenCalledWith('ana@x.com', '123456');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(cache.invalidateUser).toHaveBeenCalledWith('u1');
    expect(res.message).toMatch(/Senha alterada/);
  });

  it('código errado ou expirado: não troca nada', async () => {
    const { service, prisma, neon } = setup();
    neon.consumeResetCode.mockResolvedValue({ ok: false, status: 400, code: 'INVALID_OTP', message: 'Invalid OTP' });
    await expect(service.resetWithCode({ email: 'ana@x.com', code: '000000', newPassword: 'novaSenha1' })).rejects.toThrow('Código inválido ou expirado');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('muitas tentativas no Neon: pede um código novo', async () => {
    const { service, neon } = setup();
    neon.consumeResetCode.mockResolvedValue({ ok: false, status: 403, code: 'TOO_MANY_ATTEMPTS', message: '' });
    await expect(service.resetWithCode({ email: 'ana@x.com', code: '000000', newPassword: 'novaSenha1' })).rejects.toThrow('Muitas tentativas');
  });

  it('limite de pedidos: o 4º código em 15 minutos para o mesmo e-mail é recusado', async () => {
    const { service } = setup();
    for (let i = 0; i < 3; i++) await service.requestCode({ email: 'limite@x.com' }, `9.9.9.${i}`);
    await expect(service.requestCode({ email: 'limite@x.com' }, '9.9.9.9')).rejects.toThrow('Muitos pedidos');
  });

  it('sem NEON_AUTH_URL: avisa para pedir senha à empresa', async () => {
    const { service, neon } = setup();
    neon.isConfigured.mockReturnValue(false);
    await expect(service.requestCode({ email: 'ana@x.com' }, '1.1.1.4')).rejects.toThrow('administrador da sua empresa');
  });
});
