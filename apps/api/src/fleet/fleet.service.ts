import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateFleetDto) {
    const unitId = await this.resolveUnitId(createDto.unitId);
    return this.prisma.fleet.create({
      // O tenantId é preenchido pela extensão do Prisma.
      data: { name: createDto.name, description: createDto.description || null, unitId } as never,
    });
  }

  /**
   * A frota precisa de uma unidade. O painel ainda não tem tela de unidades, então, sem unitId,
   * usa a primeira unidade ativa da empresa ou cria a "Unidade principal".
   */
  private async resolveUnitId(unitId?: string): Promise<string> {
    if (unitId) {
      // A extensão do Prisma restringe a busca à empresa de quem está logado.
      const unit = await this.prisma.unit.findFirst({ where: { id: unitId }, select: { id: true } });
      if (!unit) throw new NotFoundException('Unidade não encontrada.');
      return unit.id;
    }
    const existing = await this.prisma.unit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.unit.create({ data: { name: 'Unidade principal' } as never, select: { id: true } });
    return created.id;
  }

  async findAll() {
    return this.prisma.fleet.findMany({
      include: {
        vehicles: true,
        _count: { select: { vehicles: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.fleet.findUnique({
      where: { id },
      include: {
        vehicles: true,
        _count: { select: { vehicles: true } },
      },
    });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: UpdateFleetDto) {
    await this.findOne(id);
    const data: { name?: string; description?: string | null; unitId?: string; isActive?: boolean } = {};
    if (updateDto.name !== undefined) data.name = updateDto.name;
    if (updateDto.description !== undefined) data.description = updateDto.description || null;
    if (updateDto.isActive !== undefined) data.isActive = updateDto.isActive;
    if (updateDto.unitId !== undefined) data.unitId = await this.resolveUnitId(updateDto.unitId);
    return this.prisma.fleet.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.fleet.delete({ where: { id } });
  }
}
