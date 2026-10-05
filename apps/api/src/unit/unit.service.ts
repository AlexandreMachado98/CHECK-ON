import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateUnitDto) {
    return this.prisma.unit.create({ data: createDto as any });
  }

  async findAll() {
    return this.prisma.unit.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const record = await this.prisma.unit.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: UpdateUnitDto) {
    await this.findOne(id);
    return this.prisma.unit.update({ where: { id }, data: updateDto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.unit.delete({ where: { id } });
  }
}
