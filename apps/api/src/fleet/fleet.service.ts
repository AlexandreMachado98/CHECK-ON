import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { currentUnitIds } from '../common/unit-scope';
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
   * Frente de trabalho da frota. Sem unitId: a única frente de quem cadastra (ou da empresa);
   * com mais de uma, é preciso escolher. Empresa sem frente nenhuma ganha a "Unidade principal".
   */
  private async resolveUnitId(unitId?: string): Promise<string> {
    if (unitId) {
      // A extensão do Prisma restringe a busca à empresa e às frentes de quem está logado.
      const unit = await this.prisma.unit.findFirst({ where: { id: unitId }, select: { id: true } });
      if (!unit) throw new NotFoundException('Frente de trabalho não encontrada.');
      return unit.id;
    }
    const scope = currentUnitIds();
    if (scope) {
      if (scope.length === 1) return scope[0];
      throw new BadRequestException('Escolha a frente de trabalho da frota.');
    }
    const active = await this.prisma.unit.findMany({ where: { isActive: true }, select: { id: true }, take: 2 });
    if (active.length > 1) throw new BadRequestException('Escolha a frente de trabalho da frota.');
    if (active.length === 1) return active[0].id;
    const created = await this.prisma.unit.create({ data: { name: 'Unidade principal' } as never, select: { id: true } });
    return created.id;
  }

  async findAll() {
    return this.prisma.fleet.findMany({
      include: {
        vehicles: true,
        unit: { select: { id: true, name: true, client: true } },
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
        unit: { select: { id: true, name: true, client: true } },
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
