import { describe, expect, it, vi } from 'vitest';
import { MasterService } from './master.service';

const base = {
  id: 't1', name: 'Logística Gama', cnpj: null, code: 'GAMA', plan: 'STARTER', isActive: true, billingCycle: 'MENSAL',
  subscriptionEndsAt: null, graceDays: 5, masterNotes: null, createdAt: new Date(), archivedAt: null as Date | null,
};

function service(row: typeof base) {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    tenant: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue(row), delete: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    masterAuditLog: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue({ details: JSON.stringify({ wasActive: false }) }), findMany: vi.fn().mockResolvedValue([]) },
    user: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    employee: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    vehicle: { count: vi.fn().mockResolvedValue(0) },
    checklist: { count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn() },
    nonConformity: { count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn() },
    checklistAnswer: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : arg)),
  };
  const sessionCache = { invalidateTenant: vi.fn(), invalidateUser: vi.fn() };
  const storage = { deleteTenantChecklistPhotos: vi.fn().mockResolvedValue(0), deleteFile: vi.fn() };
  return { svc: new MasterService(prisma as never, sessionCache as never, {} as never, storage as never), prisma, sessionCache };
}

describe('MasterService: arquivar e excluir', () => {
  it('excluir definitivamente exige empresa arquivada', async () => {
    const { svc, prisma } = service({ ...base });
    await expect(svc.deletePermanently('t1', 'Logística Gama')).rejects.toThrow('Arquive a empresa antes');
    expect(prisma.tenant.delete).not.toHaveBeenCalled();
  });
  it('exige o nome exato (sem diferenciar maiúsculas e espaços nas pontas)', async () => {
    const { svc, prisma } = service({ ...base, archivedAt: new Date() });
    await expect(svc.deletePermanently('t1', 'Gama')).rejects.toThrow('digite o nome da empresa');
    await expect(svc.deletePermanently('t1', '')).rejects.toThrow('digite o nome da empresa');
    expect(prisma.tenant.delete).not.toHaveBeenCalled();
    await expect(svc.deletePermanently('t1', '  logística gama ')).resolves.toMatchObject({ deleted: true });
    expect(prisma.tenant.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
  it('arquivar bloqueia o acesso e derruba as sessões', async () => {
    const { svc, prisma, sessionCache } = service({ ...base });
    prisma.tenant.findUnique.mockResolvedValueOnce({ ...base }).mockResolvedValue({ ...base, archivedAt: new Date() });
    await svc.archive('t1', 'master@example.com');
    expect(prisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false, archivedAt: expect.any(Date) }) }));
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(sessionCache.invalidateTenant).toHaveBeenCalledWith('t1');
  });
  it('restaurar volta à situação de antes (estava suspensa: continua suspensa)', async () => {
    const { svc, prisma } = service({ ...base, archivedAt: new Date(), isActive: false });
    await svc.restore('t1');
    expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { archivedAt: null, isActive: false } });
  });
  it('arquivada não pode ser renovada nem alterada', async () => {
    const { svc } = service({ ...base, archivedAt: new Date() });
    await expect(svc.renew('t1', { months: 1 })).rejects.toThrow('Restaure antes');
    await expect(svc.updateCompany('t1', { name: 'X' })).rejects.toThrow('Restaure antes');
  });
});
