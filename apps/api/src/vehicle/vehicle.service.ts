import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_NC_STATUSES, escalateVehicleStatus, vehicleStatusFromActiveNcs } from '../checklist/checklist-rules';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateVehicleDto) {
    await this.assertFleet(createDto.fleetId);
    return this.prisma.vehicle.create({ data: createDto as any });
  }

  async findAll() {
    return this.prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        fleet: { select: { id: true, name: true } },
        _count: { select: { ncs: { where: { status: { in: ACTIVE_NC_STATUSES } } } } },
      },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: UpdateVehicleDto) {
    await this.findOne(id);
    if (updateDto.fleetId) await this.assertFleet(updateDto.fleetId);

    if (updateDto.status) {
      const activeNcs = await this.prisma.nonConformity.findMany({
        where: { vehicleId: id, status: { in: ACTIVE_NC_STATUSES } },
        select: { severity: true },
      });
      const minimum = vehicleStatusFromActiveNcs(activeNcs.map((nc) => nc.severity));
      if (escalateVehicleStatus(updateDto.status, minimum) !== updateDto.status) {
        throw new ConflictException(
          minimum === 'BLOQUEADO'
            ? 'Este veículo tem NC crítica ativa. Resolva a NC antes de liberá-lo.'
            : 'Este veículo tem NC ativa. Resolva as NCs antes de liberá-lo.',
        );
      }
    }

    return this.prisma.vehicle.update({ where: { id }, data: updateDto as any });
  }

  /** A frota precisa existir na mesma empresa (o filtro de tenant é aplicado pelo Prisma). */
  private async assertFleet(fleetId: string) {
    const fleet = await this.prisma.fleet.findFirst({ where: { id: fleetId }, select: { id: true } });
    if (!fleet) throw new NotFoundException('Frota não encontrada.');
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.delete({ where: { id } });
  }
}
