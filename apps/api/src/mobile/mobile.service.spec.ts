import { NotFoundException } from '@nestjs/common';
import { MobileService, ACTIVE_NC_STATUSES } from './mobile.service';

function buildService() {
  const prisma = {
    template: { findMany: vi.fn().mockResolvedValue([{ id: 'tpl-1', categories: [] }]) },
    vehicle: { findMany: vi.fn().mockResolvedValue([{ id: 'v1', plate: 'ABC1D23' }]), findFirst: vi.fn() },
    nonConformity: { findMany: vi.fn().mockResolvedValue([{ id: 'nc-1', vehicleId: 'v1' }]) },
  };
  return { prisma, service: new MobileService(prisma as any) };
}

describe('MobileService', () => {
  it('bootstrap traz só modelos e veículos ativos e NCs ainda em aberto', async () => {
    const { prisma, service } = buildService();

    const result = await service.bootstrap();

    expect(prisma.template.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(prisma.vehicle.findMany.mock.calls[0][0].where).toEqual({ isActive: true, fleet: { isActive: true } });
    expect(prisma.nonConformity.findMany.mock.calls[0][0].where).toEqual({
      status: { in: ACTIVE_NC_STATUSES },
      vehicle: { isActive: true },
    });
    expect(result.templates).toHaveLength(1);
    expect(result.vehicles).toHaveLength(1);
    expect(result.openNcs).toHaveLength(1);
    expect(Number.isNaN(Date.parse(result.serverTime))).toBe(false);
  });

  it('bootstrap envia ao app as regras de cada item (tipo, crítico, foto obrigatória)', async () => {
    const { prisma, service } = buildService();
    await service.bootstrap();

    const select = prisma.template.findMany.mock.calls[0][0].select;
    expect(select.version).toBe(true);
    expect(select.categories.where).toEqual({ isActive: true });
    expect(select.categories.select.items.where).toEqual({ isActive: true });
    expect(select.categories.select.items.select).toMatchObject({ type: true, isRequired: true, isCritical: true, photoRequirement: true });
  });

  it('busca o veículo pelo QR Code e anexa as NCs ativas', async () => {
    const { prisma, service } = buildService();
    prisma.vehicle.findFirst.mockResolvedValue({ id: 'v1', plate: 'ABC1D23' });

    const result = await service.findVehicleByQrCode('QR-123');

    expect(prisma.vehicle.findFirst.mock.calls[0][0].where).toEqual({ qrCode: 'QR-123', isActive: true, fleet: { isActive: true } });
    expect(prisma.nonConformity.findMany.mock.calls[0][0].where).toEqual({
      vehicleId: 'v1',
      status: { in: ACTIVE_NC_STATUSES },
    });
    expect(result.openNcs).toEqual([{ id: 'nc-1', vehicleId: 'v1' }]);
  });

  it('QR Code desconhecido (ou de outra empresa) retorna 404', async () => {
    const { prisma, service } = buildService();
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(service.findVehicleByQrCode('QR-x')).rejects.toThrow(NotFoundException);
    expect(prisma.nonConformity.findMany).not.toHaveBeenCalled();
  });

  it('NCs de veículo inexistente ou inativo retornam 404', async () => {
    const { prisma, service } = buildService();
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(service.findVehicleOpenNcs('v-x')).rejects.toThrow(NotFoundException);
  });
});
