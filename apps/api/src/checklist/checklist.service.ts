import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { withAnsweredItem } from './answer-snapshot';

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateChecklistDto) {
    return this.prisma.checklist.create({ data: createDto as any });
  }

  async findAll() {
    const records = await this.prisma.checklist.findMany({
      include: {
        template: true,
        vehicle: true,
        driver: true,
        answers: { include: { item: true, nonConformity: true } }
      },
      orderBy: { startedAt: 'desc' }
    });
    return records.map((record) => ({ ...record, answers: record.answers.map(withAnsweredItem) }));
  }

  async findOne(id: string) {
    const record = await this.prisma.checklist.findUnique({
      where: { id },
      include: {
        template: true,
        vehicle: true,
        driver: true,
        answers: { include: { item: true, nonConformity: true } }
      }
    });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return { ...record, answers: record.answers.map(withAnsweredItem) };
  }

  async update(id: string, updateDto: UpdateChecklistDto) {
    await this.findOne(id);
    return this.prisma.checklist.update({ where: { id }, data: updateDto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.checklist.delete({ where: { id } });
  }
}
