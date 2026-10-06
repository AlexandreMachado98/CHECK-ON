import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateFleetDto) {
    return this.prisma.fleet.create({ data: createDto as any });
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
    return this.prisma.fleet.update({ where: { id }, data: updateDto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.fleet.delete({ where: { id } });
  }
}
