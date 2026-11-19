import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { withAnsweredItem } from './answer-snapshot';
import { ChecklistPageQueryDto, Page, pageArgs } from '../common/pagination';
import { SEARCH_LIMIT, containsPattern, currentTenantId, plain } from '../common/search-sql';
import { Prisma } from '@prisma/client';

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

  /**
   * Lista leve e paginada para a tela de Inspeções: sem as respostas (que vêm só nos detalhes),
   * com a contagem de itens não conformes. Busca por placa, motorista ou modelo, sem diferenciar maiúsculas.
   */
  async findPage(query: ChecklistPageQueryDto) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const term = query.search?.trim();
    const where: Prisma.ChecklistWhereInput = {
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
      ...(term ? { id: { in: await this.searchIds(term) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.checklist.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          syncedAt: true,
          templateName: true,
          template: { select: { id: true, name: true } },
          vehicle: { select: { id: true, plate: true, model: true, brand: true } },
          driver: { select: { id: true, name: true } },
          _count: { select: { answers: { where: { isCompliant: false } } } },
        },
      }),
      this.prisma.checklist.count({ where }),
    ]);
    const result: Page<(typeof items)[number] & { ncCount: number }> = {
      items: items.map((item) => ({ ...item, ncCount: item._count.answers })),
      total,
      page,
      pageSize,
    };
    return result;
  }

  /** Inspeções cuja placa, motorista ou modelo contém o termo, sem diferenciar acentos e maiúsculas. */
  private async searchIds(term: string): Promise<string[]> {
    const tenantId = currentTenantId();
    const pattern = containsPattern(term);
    const platePattern = containsPattern(term.replace(/[^a-zA-Z0-9]/g, '') || term);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM "Checklist" c
      JOIN "Vehicle" v ON v.id = c."vehicleId"
      JOIN "Employee" e ON e.id = c."driverId"
      LEFT JOIN "Template" t ON t.id = c."templateId"
      WHERE c."tenantId" = ${tenantId}
        AND (${plain('v."plate"')} LIKE ${platePattern}
          OR ${plain('e."name"')} LIKE ${pattern}
          OR ${plain('c."templateName"')} LIKE ${pattern}
          OR ${plain('t."name"')} LIKE ${pattern})
      LIMIT ${SEARCH_LIMIT}`;
    return rows.map((row) => row.id);
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
