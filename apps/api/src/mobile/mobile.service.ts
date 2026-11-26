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
  // unitId: frente de trabalho do veículo (o app filtra os checklists por ela).
  fleet: { select: { id: true, name: true, unitId: true, unit: { select: { name: true } } } },
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
          version: true,
          updatedAt: true,
          askOdometer: true,
          // Frentes do modelo: o app só oferece o checklist nos veículos dessas frentes.
          allUnits: true,
          units: { select: { unitId: true } },
          categories: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            select: {
              id: true,
              name: true,
              order: true,
              items: {
                where: { isActive: true },
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
        // Veículo de frota inativa (arquivada) não aparece no app.
        where: { isActive: true, fleet: { isActive: true } },
        orderBy: { plate: 'asc' },
        select: VEHICLE_SELECT,
      }),
      this.prisma.nonConformity.findMany({
        where: { status: { in: ACTIVE_NC_STATUSES }, vehicle: { isActive: true } },
        orderBy: { createdAt: 'desc' },
        select: NC_SELECT,
      }),
    ]);

    // Última inspeção de cada veículo: o motorista vê se alguém já inspecionou hoje.
    const last = await this.lastInspections(vehicles.map((vehicle) => vehicle.id));
    return {
      serverTime: new Date().toISOString(),
      templates,
      vehicles: vehicles.map((vehicle) => ({ ...vehicle, lastInspection: last.get(vehicle.id) ?? null })),
      openNcs,
    };
  }

  /**
   * Última inspeção concluída de cada veículo (data e motorista). Duas consultas leves: o máximo por
   * veículo (groupBy) e depois só essas inspeções. Já filtradas pela empresa e pelas frentes de quem pede.
   */
  private async lastInspections(vehicleIds: string[]): Promise<Map<string, { completedAt: string; driverName: string | null }>> {
    const result = new Map<string, { completedAt: string; driverName: string | null }>();
    if (vehicleIds.length === 0) return result;
    const maxes = await this.prisma.checklist.groupBy({
      by: ['vehicleId'],
      where: { vehicleId: { in: vehicleIds }, completedAt: { not: null } },
      _max: { completedAt: true },
    });
    const pairs = maxes
      .filter((row) => row._max.completedAt)
      .map((row) => ({ vehicleId: row.vehicleId, completedAt: row._max.completedAt as Date }));
    if (pairs.length === 0) return result;
    const rows = await this.prisma.checklist.findMany({
      where: { OR: pairs },
      select: { vehicleId: true, completedAt: true, driver: { select: { name: true } } },
    });
    for (const row of rows) {
      if (!row.completedAt || result.has(row.vehicleId)) continue;
      result.set(row.vehicleId, { completedAt: row.completedAt.toISOString(), driverName: row.driver?.name ?? null });
    }
    return result;
  }

  /** Veículo lido pelo QR Code, com as NCs ativas para o alerta antes do checklist. */
  async findVehicleByQrCode(qrCode: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { qrCode, isActive: true, fleet: { isActive: true } },
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
