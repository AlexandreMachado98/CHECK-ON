import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

/** Frentes de trabalho / contratos. A lista já vem filtrada pelas frentes de quem pede. */
@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: { name: dto.name.trim(), client: dto.client?.trim() || null } as never,
      include: this.counts(),
    });
  }

  async findAll() {
    return this.prisma.unit.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }], include: this.counts() });
  }

  async findOne(id: string) {
    const record = await this.prisma.unit.findUnique({ where: { id }, include: this.counts() });
    if (!record) throw new NotFoundException('Frente de trabalho não encontrada.');
    return record;
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findOne(id);
    return this.prisma.unit.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        client: dto.client === undefined ? undefined : dto.client?.trim() || null,
        isActive: dto.isActive,
      },
      include: this.counts(),
    });
  }

  /** Só exclui frente sem frotas; com frotas, mova-as para outra frente ou desative a frente. */
  async remove(id: string) {
    const unit = await this.findOne(id);
    if (unit._count.fleets > 0) {
      throw new ConflictException('Esta frente tem frotas. Mova as frotas para outra frente ou desative a frente.');
    }
    return this.prisma.unit.delete({ where: { id } });
  }

  private counts() {
    return { _count: { select: { fleets: true, employees: true, users: true } } } as const;
  }
}
