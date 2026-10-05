import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNcDto } from './dto/update-nc.dto';

@Injectable()
export class NcService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.nonConformity.findMany({
      include: {
        answer: {
          include: {
            item: true,
            checklist: {
              include: { vehicle: true, driver: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, updateNcDto: UpdateNcDto) {
    const record = await this.prisma.nonConformity.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('NC não encontrada');

    const data: any = { ...updateNcDto };
    if (updateNcDto.status === 'RESOLVED') {
      data.resolvedAt = new Date();
    }

    return this.prisma.nonConformity.update({
      where: { id },
      data,
    });
  }
}
