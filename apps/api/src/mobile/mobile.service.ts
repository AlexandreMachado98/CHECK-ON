import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** NCs que ainda exigem atenção no veículo (as mesmas usadas na regra de reincidência). */
export const ACTIVE_NC_STATUSES = ['OPEN', 'IN_PROGRESS'];

const VEHICLE_SELECT = {
  id: true,
  plate: true,
  prefix: true,
  brand: true,
  model: true,
  year: true,
  status: true,
  mileage: true,
  qrCode: true,
  fleet: { select: { id: true, name: true } },
} as const;

const NC_SELECT = {
  id: true,
  vehicleId: true,
  itemId: true,
  status: true,
  severity: true,
  notes: true,
  occurrences: true,
  lastOccurrenceAt: true,
  createdAt: true,
  item: { select: { text: true, isCritical: true } },
} as const;

/**
 * Leitura de dados para o app operacional.
 * O isolamento por empresa vem do PrismaService (tenantId do token).
 */
@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pacote que o app baixa com internet para conseguir operar offline. */
  async bootstrap() {
    const [templates, vehicles, openNcs] = await Promise.all([
      this.prisma.template.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
          categories: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              name: true,
              order: true,
              items: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  text: true,
                  type: true,
                  isRequired: true,
                  isCritical: true,
                  photoRequirement: true,
                  order: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.vehicle.findMany({
        where: { isActive: true },
        orderBy: { plate: 'asc' },
        select: VEHICLE_SELECT,
      }),
      this.prisma.nonConformity.findMany({
        where: { status: { in: ACTIVE_NC_STATUSES }, vehicle: { isActive: true } },
        orderBy: { createdAt: 'desc' },
        select: NC_SELECT,
      }),
    ]);

    return { serverTime: new Date().toISOString(), templates, vehicles, openNcs };
  }

  /** Veículo lido pelo QR Code, com as NCs ativas para o alerta antes do checklist. */
  async findVehicleByQrCode(qrCode: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { qrCode, isActive: true },
      select: VEHICLE_SELECT,
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado para este QR Code.');
    return { ...vehicle, openNcs: await this.activeNcs(vehicle.id) };
  }

  async findVehicleOpenNcs(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, isActive: true },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado ou inativo.');
    return this.activeNcs(vehicle.id);
  }

  private activeNcs(vehicleId: string) {
    return this.prisma.nonConformity.findMany({
      where: { vehicleId, status: { in: ACTIVE_NC_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: NC_SELECT,
    });
  }
}
