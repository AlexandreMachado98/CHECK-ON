import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenancePlanDto, MaintenanceScheduleDto, RecordMaintenanceDto } from './maintenance.dto';

const vehicle = {
  select: { id: true, plate: true, prefix: true, mileage: true, isActive: true },
} satisfies Prisma.VehicleDefaultArgs;

export function maintenanceDue(baseKm: number, intervalKm: number, warningKm: number, mileage: number) {
  const dueKm = baseKm + intervalKm;
  const remainingKm = dueKm - mileage;
  const status = remainingKm < 0 ? 'OVERDUE'
    : remainingKm === 0 ? 'DUE'
    : remainingKm <= warningKm ? 'UPCOMING' : 'ON_TRACK';
  return { dueKm, remainingKm, status };
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const plans = await this.prisma.maintenancePlan.findMany({
      select: {
        id: true, name: true, baseKm: true, intervalKm: true, warningKm: true, archivedAt: true, vehicle,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return plans.map((plan) => ({
      ...plan,
      ...maintenanceDue(plan.baseKm, plan.intervalKm, plan.warningKm, plan.vehicle.mileage),
    }));
  }

  async create(dto: CreateMaintenancePlanDto) {
    this.validateSchedule(dto);
    const vehicleRecord = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, isActive: true },
      select: { tenantId: true, mileage: true },
    });
    if (!vehicleRecord) throw new NotFoundException('Veículo ativo não encontrado.');
    if (dto.baseKm > vehicleRecord.mileage) {
      throw new BadRequestException('O km inicial deve ser igual ou menor que o km atual do veículo.');
    }
    return this.prisma.maintenancePlan.create({ data: { ...dto, tenantId: vehicleRecord.tenantId } });
  }

  async update(id: string, dto: MaintenanceScheduleDto) {
    this.validateSchedule(dto);
    const result = await this.prisma.maintenancePlan.updateMany({ where: { id, archivedAt: null }, data: dto });
    if (!result.count) throw new NotFoundException('Plano de manutenção ativo não encontrado.');
  }

  async archive(id: string) {
    const result = await this.prisma.maintenancePlan.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Plano de manutenção ativo não encontrado.');
  }

  async history(id: string) {
    const plan = await this.prisma.maintenancePlan.findUnique({
      where: { id },
      select: { services: { orderBy: { mileageKm: 'desc' } } },
    });
    if (!plan) throw new NotFoundException('Plano de manutenção não encontrado.');
    return plan.services;
  }

  async record(id: string, dto: RecordMaintenanceDto) {
    const plan = await this.prisma.maintenancePlan.findUnique({
      where: { id, archivedAt: null, vehicle: { isActive: true } },
      select: { baseKm: true, vehicle: { select: { mileage: true } }, _count: { select: { services: true } } },
    });
    if (!plan) throw new NotFoundException('Plano de manutenção ativo não encontrado.');
    if (dto.mileageKm < plan.baseKm || (dto.mileageKm === plan.baseKm && plan._count.services > 0)) {
      throw new BadRequestException('Informe um km posterior ao do último serviço, ou a partir do km inicial no primeiro registro.');
    }
    if (dto.mileageKm > plan.vehicle.mileage) {
      throw new BadRequestException('O km do serviço deve ser igual ou menor que o km atual do veículo.');
    }

    try {
      // A atualização da referência e o registro do serviço são gravados juntos.
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.maintenancePlan.updateMany({
          where: {
            id, archivedAt: null, baseKm: plan.baseKm,
            vehicle: { isActive: true, mileage: { gte: dto.mileageKm } },
          },
          data: { baseKm: dto.mileageKm },
        });
        if (!result.count) throw new ConflictException('O plano ou o km do veículo mudou. Atualize a página.');
        return tx.maintenanceService.create({
          data: { planId: id, mileageKm: dto.mileageKm, notes: dto.notes?.trim() || null },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('O serviço já foi registrado neste km. Atualize a página.');
      }
      throw error;
    }
  }

  private validateSchedule(dto: MaintenanceScheduleDto) {
    if (dto.warningKm >= dto.intervalKm) {
      throw new BadRequestException('A antecedência do aviso deve ser menor que o intervalo do plano.');
    }
  }
}
