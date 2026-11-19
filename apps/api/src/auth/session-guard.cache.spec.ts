import { describe, expect, it, vi } from 'vitest';
import { SessionGuardCache } from './session-guard.cache';
import { generateTemporaryPassword } from './password';

function guard(user: Record<string, unknown>, tenant: Record<string, unknown> = { isActive: true, sessionsRevokedAt: null }) {
  const prisma = { $queryRaw: vi.fn((strings: TemplateStringsArray) => Promise.resolve([strings.join('').includes('"Tenant"') ? tenant : user])) };
  return new SessionGuardCache(prisma as never);
}
const active = { isActive: true, mustChangePassword: false, passwordChangedAt: null };
const now = Math.floor(Date.now() / 1000);

describe('SessionGuardCache', () => {
  it('login válido passa', async () => {
    await expect(guard(active).assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/vehicles')).resolves.toBeUndefined();
  });
  it('senha provisória: só libera a troca de senha', async () => {
    const g = guard({ ...active, mustChangePassword: true });
    await expect(g.assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/mobile/bootstrap')).rejects.toThrow('Defina uma nova senha');
    await expect(g.assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/auth/change-password')).resolves.toBeUndefined();
  });
  it('token emitido antes da troca de senha cai', async () => {
    const g = guard({ ...active, passwordChangedAt: new Date() });
    await expect(g.assertValid({ sub: 'u', tenantId: 't', iat: now - 60 }, '/vehicles')).rejects.toThrow('Sua senha foi alterada');
  });
  it('token emitido depois da troca continua valendo', async () => {
    const g = guard({ ...active, passwordChangedAt: new Date((now - 60) * 1000) });
    await expect(g.assertValid({ sub: 'u', tenantId: 't', iat: now }, '/vehicles')).resolves.toBeUndefined();
  });
  it('usuário bloqueado cai', async () => {
    await expect(guard({ ...active, isActive: false }).assertValid({ sub: 'u', tenantId: 't', iat: now })).rejects.toThrow('bloqueado');
  });
});

describe('senha provisória', () => {
  it('tem 10 caracteres, sem os que se confundem (0, O, 1, l, I)', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(10);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });
});
