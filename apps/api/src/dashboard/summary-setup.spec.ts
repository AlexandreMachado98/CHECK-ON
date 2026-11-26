import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

const row = {
  activeVehicles: 0, activeFleets: 1, activeEmployees: 0, activeUsers: 1, liberados: 0, atencao: 0, bloqueados: 0,
  ncsActive: 0, ncsCritical: 0, ncsRecurrent: 0, inspectionsToday: 0, inspectionsWeek: 0,
  hasTemplate: true, hasAppAccess: false, hasInspection: false, hasMaintenancePlan: false, hasPassengerQr: true,
};

describe('Resumo do painel — primeiros passos da empresa', () => {
  it('devolve o que já foi feito na implantação (modelo, acesso ao app, primeira inspeção)', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([row]) };
    const cls = { get: vi.fn().mockReturnValue('tenant-1') };
    const summary = await new DashboardService(prisma as never, cls as never).getSummary();
    expect(summary.setup).toEqual({ hasTemplate: true, hasAppAccess: false, hasInspection: false, hasMaintenancePlan: false, hasPassengerQr: true });
    expect(summary.activeFleets).toBe(1);
  });
});
