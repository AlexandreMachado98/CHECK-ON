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

describe('sessão do aplicativo (sem senha)', () => {
  const app = { sub: 'u', tenantId: 't', iat: now, channel: 'app' };
  it.each(['/api/mobile/bootstrap', '/api/checklists/submit', '/checklists/sync', '/api/checklists/photos', '/api/auth/me'])('libera %s', async (path) => {
    await expect(guard(active).assertValid(app, path)).resolves.toBeUndefined();
  });
  it.each(['/api/vehicles', '/api/users', '/api/checklists', '/api/ncs?page=1', '/api/company', '/api/auth/change-password'])('bloqueia %s', async (path) => {
    await expect(guard(active).assertValid(app, path)).rejects.toThrow('só para o aplicativo');
  });
  it('senha provisória não trava o app', async () => {
    await expect(guard({ ...active, mustChangePassword: true }).assertValid(app, '/api/mobile/bootstrap')).resolves.toBeUndefined();
  });
});


describe('assinatura (DDS Master)', () => {
  const day = 86400000;
  const tenant = (endsDaysAgo: number | null, graceDays = 5) => ({
    isActive: true,
    sessionsRevokedAt: null,
    subscriptionEndsAt: endsDaysAgo === null ? null : new Date(Date.now() - endsDaysAgo * day),
    graceDays,
  });
  it('sem vencimento ou dentro do prazo: passa', async () => {
    await expect(guard(active, tenant(null)).assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/vehicles')).resolves.toBeUndefined();
    await expect(guard(active, tenant(-3)).assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/vehicles')).resolves.toBeUndefined();
  });
  it('na carência: passa', async () => {
    await expect(guard(active, tenant(2)).assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/vehicles')).resolves.toBeUndefined();
  });
  it('vencida: derruba portal e aplicativo com o código SUBSCRIPTION_EXPIRED', async () => {
    const g = guard(active, tenant(10));
    await expect(g.assertValid({ sub: 'u', tenantId: 't', iat: now }, '/api/vehicles')).rejects.toMatchObject({ response: { code: 'SUBSCRIPTION_EXPIRED' } });
    await expect(g.assertValid({ sub: 'u', tenantId: 't', iat: now, channel: 'app' }, '/api/checklists/sync')).rejects.toThrow('venceu');
  });
  it('vencida: o super admin pelo "Acessar empresa" continua entrando', async () => {
    await expect(guard(active, tenant(10)).assertValid({ sub: 'u', tenantId: 't', iat: now, impersonatedBy: 'admin' }, '/api/vehicles')).resolves.toBeUndefined();
  });
});
