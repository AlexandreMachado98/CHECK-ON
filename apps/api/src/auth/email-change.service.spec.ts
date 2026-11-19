import { describe, expect, it, vi } from 'vitest';
import { EmailChangeService } from './email-change.service';

const compare = vi.fn();
vi.mock('bcrypt', () => ({ compare: (...args: unknown[]) => compare(...args) }));

const me = { id: 'u1', name: 'Alexandre', email: 'admin@checkon.com', passwordHash: 'h', pendingEmail: null, pendingEmailRequestedAt: null };

function setup(user: Record<string, unknown> = me, emailTaken = false, configured = true) {
  const prisma = {
    $queryRaw: vi.fn((strings: TemplateStringsArray) =>
      Promise.resolve(strings.join('').includes('<> ') ? (emailTaken ? [{ id: 'outro' }] : []) : [user])),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const neon = {
    isConfigured: vi.fn().mockReturnValue(configured),
    ensureUser: vi.fn().mockResolvedValue({ ok: true }),
    sendEmailVerificationCode: vi.fn().mockResolvedValue({ ok: true }),
    verifyEmailCode: vi.fn().mockResolvedValue({ ok: true }),
  };
  return { prisma, neon, service: new EmailChangeService(prisma as never, neon as never) };
}

describe('troca do próprio e-mail', () => {
  it('senha certa: envia código para o NOVO e-mail e guarda o pedido', async () => {
    compare.mockResolvedValue(true);
    const { service, neon, prisma } = setup();
    const res = await service.request('u1', { newEmail: 'alexandre@empresa.com', currentPassword: 'x' });
    expect(res.requiresCode).toBe(true);
    expect(neon.sendEmailVerificationCode).toHaveBeenCalledWith('alexandre@empresa.com');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('senha errada: não envia nada', async () => {
    compare.mockResolvedValue(false);
    const { service, neon } = setup();
    await expect(service.request('u2', { newEmail: 'a@b.com', currentPassword: 'errada' })).rejects.toThrow('senha atual não confere');
    expect(neon.sendEmailVerificationCode).not.toHaveBeenCalled();
  });

  it('e-mail de outro acesso: recusa', async () => {
    compare.mockResolvedValue(true);
    const { service } = setup(me, true);
    await expect(service.request('u3', { newEmail: 'outro@x.com', currentPassword: 'x' })).rejects.toThrow('já é usado');
  });

  it('código certo: troca o e-mail', async () => {
    const pending = { ...me, pendingEmail: 'alexandre@empresa.com', pendingEmailRequestedAt: new Date() };
    const { service, prisma } = setup(pending);
    const res = await service.confirm('u1', { newEmail: 'alexandre@empresa.com', code: '123456' });
    expect(res.email).toBe('alexandre@empresa.com');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('código errado: mantém o e-mail antigo', async () => {
    const pending = { ...me, pendingEmail: 'alexandre@empresa.com', pendingEmailRequestedAt: new Date() };
    const { service, neon, prisma } = setup(pending);
    neon.verifyEmailCode.mockResolvedValue({ ok: false, status: 400, code: 'INVALID_OTP', message: '' });
    await expect(service.confirm('u1', { newEmail: 'alexandre@empresa.com', code: '000000' })).rejects.toThrow('Código inválido');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('confirmar outro e-mail (não o pedido) ou pedido vencido: recusa sem consultar o Neon', async () => {
    const old = { ...me, pendingEmail: 'alexandre@empresa.com', pendingEmailRequestedAt: new Date(Date.now() - 20 * 60 * 1000) };
    for (const [user, email] of [[{ ...old, pendingEmailRequestedAt: new Date() }, 'invasor@x.com'], [old, 'alexandre@empresa.com']] as const) {
      const { service, neon } = setup(user);
      await expect(service.confirm('u1', { newEmail: email, code: '123456' })).rejects.toThrow('expirado');
      expect(neon.verifyEmailCode).not.toHaveBeenCalled();
    }
  });

  it('sem Neon Auth configurado: troca direto após conferir a senha', async () => {
    compare.mockResolvedValue(true);
    const { service, neon } = setup(me, false, false);
    const res = await service.request('u4', { newEmail: 'novo@x.com', currentPassword: 'x' });
    expect(res).toEqual({ requiresCode: false, email: 'novo@x.com' });
    expect(neon.sendEmailVerificationCode).not.toHaveBeenCalled();
  });
});
