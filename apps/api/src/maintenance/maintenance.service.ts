import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenancePlanDto, MaintenanceScheduleDto, UpdateMaintenancePlanDto, RecordMaintenanceDto } from './maintenance.dto';

const vehicle = {
  select: { id: true, plate: true, prefix: true, mileage: true, isActive: true },
} satisfies Prisma.VehicleDefaultArgs;

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function day(value: string) {
  if (value > today()) throw new BadRequestException('A data informada não pode estar no futuro.');
  return new Date(value + 'T00:00:00Z');
}

export function maintenanceDue(baseKm: number, intervalKm: number, warningKm: number, mileage: number, baseDate: Date | null, intervalDays: number | null, currentDay: string) {
  const dueKm = baseKm + intervalKm;
  const remainingKm = dueKm - mileage;
  const dueDate = baseDate && intervalDays ? new Date(baseDate.getTime() + intervalDays * 86400000).toISOString().slice(0, 10) : null;
  const status = remainingKm < 0 || (dueDate && dueDate < currentDay) ? 'OVERDUE'
    : remainingKm === 0 || dueDate === currentDay ? 'DUE'
    : remainingKm <= warningKm ? 'UPCOMING' : 'ON_TRACK';
  return { dueKm, dueDate, remainingKm, status };
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const plans = await this.prisma.maintenancePlan.findMany({
      select: {
        id: true, name: true, baseKm: true, initialKm: true, baseDate: true, intervalDays: true, _count: { select: { services: true } }, intervalKm: true, warningKm: true, archivedAt: true, vehicle,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const currentDay = today();
    return plans.map((plan) => ({
      ...plan,
      ...maintenanceDue(plan.baseKm, plan.intervalKm, plan.warningKm, plan.vehicle.mileage, plan.baseDate, plan.intervalDays, currentDay),
    }));
  }

  async create(dto: CreateMaintenancePlanDto) {
    this.validateSchedule(dto);
    return this.prisma.$transaction(async (tx) => {
      const vehicleRecord = await tx.vehicle.findFirst({
        where: { id: dto.vehicleId, isActive: true },
        select: { tenantId: true },
      });
      if (!vehicleRecord) throw new NotFoundException('Veículo ativo não encontrado.');
      // A leitura informada no portal pode anteceder ou superar a do último checklist.
      await tx.vehicle.updateMany({
        where: { id: dto.vehicleId, isActive: true, mileage: { lt: dto.baseKm } },
        data: { mileage: dto.baseKm },
      });
      return tx.maintenancePlan.create({ data: { ...dto, baseDate: dto.baseDate || dto.intervalDays ? day(dto.baseDate || today()) : null, initialKm: dto.baseKm, tenantId: vehicleRecord.tenantId } });
    });
  }

  async update(id: string, dto: UpdateMaintenancePlanDto) {
    this.validateSchedule(dto);
    const { baseKm, vehicleId, baseDate, ...schedule } = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.maintenancePlan.findFirst({
          where: { id, archivedAt: null },
          select: {
            tenantId: true, vehicleId: true, baseDate: true, intervalDays: true,
            services: { select: { mileageKm: true }, orderBy: { mileageKm: 'asc' }, take: 1 },
          },
        });
        if (!plan) throw new NotFoundException('Plano de manutenção ativo não encontrado.');
        const moving = !!vehicleId && vehicleId !== plan.vehicleId;
        const targetId = vehicleId || plan.vehicleId;
        if (moving) {
          const target = await tx.vehicle.findFirst({ where: { id: targetId, isActive: true } });
          if (!target) throw new NotFoundException('Veículo ativo não encontrado.');
          if (baseKm == null) throw new BadRequestException('Informe o km inicial do novo veículo.');
        }
        const first = plan.services[0];
        if (!moving && first && baseDate && plan.baseDate?.toISOString().slice(0, 10) !== baseDate) {
          throw new BadRequestException('O último serviço define a data de referência deste plano.');
        }
        const intervalDays = schedule.intervalDays === undefined ? plan.intervalDays : schedule.intervalDays;
        const reference = baseDate ? day(baseDate) : (moving ? null : plan.baseDate) ?? (intervalDays ? day(today()) : null);
        if (!moving && first && baseKm != null && baseKm > first.mileageKm) {
          throw new BadRequestException('O km inicial não pode ultrapassar o primeiro serviço registrado.');
        }
        if (baseKm != null) {
          await tx.vehicle.updateMany({ where: { id: targetId, mileage: { lt: baseKm } }, data: { mileage: baseKm } });
        }
        if (moving && first && baseKm != null) {
          await tx.maintenancePlan.update({ where: { id }, data: { archivedAt: new Date() } });
          return tx.maintenancePlan.create({
            data: { ...schedule, intervalDays, baseDate: reference, tenantId: plan.tenantId, vehicleId: targetId, baseKm, initialKm: baseKm },
          });
        }
        return tx.maintenancePlan.update({
          where: { id },
          data: { ...schedule, baseDate: reference, vehicleId: targetId, initialKm: baseKm ?? undefined, baseKm: first ? undefined : baseKm ?? undefined },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('O plano mudou durante a edição. Atualize e tente novamente.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const result = await this.prisma.maintenancePlan.deleteMany({ where: { id } });
    if (!result.count) throw new NotFoundException('Plano de manutenção não encontrado.');
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
      select: { services: { orderBy: [{ mileageKm: 'desc' }, { serviceDate: 'desc' }] } },
    });
    if (!plan) throw new NotFoundException('Plano de manutenção não encontrado.');
    return plan.services;
  }

  async record(id: string, dto: RecordMaintenanceDto) {
    const plan = await this.prisma.maintenancePlan.findUnique({
      where: { id, archivedAt: null, vehicle: { isActive: true } },
      select: { baseKm: true, baseDate: true, vehicle: { select: { mileage: true } }, _count: { select: { services: true } } },
    });
    if (!plan) throw new NotFoundException('Plano de manutenção ativo não encontrado.');
    const serviceDate = day(dto.serviceDate ?? today());
    if (plan.baseDate && serviceDate < plan.baseDate) {
      throw new BadRequestException('A data do serviço deve ser igual ou posterior ao início do ciclo.');
    }
    if (dto.mileageKm < plan.baseKm || (dto.mileageKm === plan.baseKm && plan._count.services > 0 && serviceDate.getTime() === plan.baseDate?.getTime())) {
      throw new BadRequestException('Confira o km e a data. A leitura não pode diminuir nem repetir um serviço no mesmo km e dia.');
    }
    if (dto.mileageKm > plan.vehicle.mileage) {
      throw new BadRequestException('O km do serviço deve ser igual ou menor que o km atual do veículo.');
    }

    try {
      // A atualização da referência e o registro do serviço são gravados juntos.
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.maintenancePlan.updateMany({
          where: {
            id, archivedAt: null, baseKm: plan.baseKm, baseDate: plan.baseDate,
            vehicle: { isActive: true, mileage: { gte: dto.mileageKm } },
          },
          data: { baseKm: dto.mileageKm, baseDate: serviceDate },
        });
        if (!result.count) throw new ConflictException('O plano ou o km do veículo mudou. Atualize a página.');
        return tx.maintenanceService.create({
          data: { planId: id, serviceDate, workshop: dto.workshop?.trim() || null, costCents: dto.costCents, mileageKm: dto.mileageKm, notes: dto.notes?.trim() || null },
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
