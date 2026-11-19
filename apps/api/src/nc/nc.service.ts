import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNcDto } from './dto/update-nc.dto';
import { itemAsAnswered, withAnsweredItem } from '../checklist/answer-snapshot';
import { ACTIVE_NC_STATUSES, canTransitionNc, vehicleStatusFromActiveNcs } from '../checklist/checklist-rules';
import { NcPageQueryDto, pageArgs } from '../common/pagination';
import { autoBlockCriticalNc } from '../company/company-settings';
import { SEARCH_LIMIT, containsPattern, currentTenantId, plain } from '../common/search-sql';
import { Prisma } from '@prisma/client';

const NC_INCLUDE = {
  vehicle: true,
  item: true,
  answer: { include: { item: true, checklist: { include: { vehicle: true, driver: true } } } },
  _count: { select: { recurrences: true } },
} satisfies Prisma.NonConformityInclude;

@Injectable()
export class NcService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const ncs = await this.prisma.nonConformity.findMany({
      include: {
        vehicle: true,
        item: true,
        answer: {
          include: {
            item: true,
            checklist: {
              include: { vehicle: true, driver: true }
            }
          }
        },
        _count: { select: { recurrences: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    // A NC mostra a pergunta como estava quando foi aberta.
    return ncs.map((nc) => ({
      ...nc,
      item: itemAsAnswered(nc.item, nc.answer),
      answer: nc.answer ? withAnsweredItem(nc.answer) : nc.answer,
    }));
  }

  /**
   * Lista paginada da tela de NCs, já filtrada por status, severidade e busca (placa, item, motorista).
   * Os contadores do topo da tela (ativas, críticas, reincidentes) vêm calculados, independentes do filtro.
   */
  async findPage(query: NcPageQueryDto) {
    const { page, pageSize, skip, take } = pageArgs(query);
    const term = query.search?.trim();
    const status = query.status ?? 'ACTIVE';
    const where: Prisma.NonConformityWhereInput = {
      ...(status === 'ACTIVE' ? { status: { in: ACTIVE_NC_STATUSES } } : status !== 'ALL' ? { status } : {}),
      ...(query.severity && query.severity !== 'ALL' ? { severity: query.severity } : {}),
      ...(term ? { id: { in: await this.searchIds(term) } } : {}),
    };
    const active = { status: { in: ACTIVE_NC_STATUSES } };
    const [ncs, total, activeCount, critical, recurrent] = await Promise.all([
      this.prisma.nonConformity.findMany({ where, include: NC_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.nonConformity.count({ where }),
      this.prisma.nonConformity.count({ where: active }),
      this.prisma.nonConformity.count({ where: { ...active, severity: 'CRITICAL' } }),
      this.prisma.nonConformity.count({ where: { ...active, occurrences: { gt: 1 } } }),
    ]);
    return {
      items: ncs.map((nc) => ({
        ...nc,
        item: itemAsAnswered(nc.item, nc.answer),
        answer: nc.answer ? withAnsweredItem(nc.answer) : nc.answer,
      })),
      total,
      page,
      pageSize,
      counts: { active: activeCount, critical, recurrent },
    };
  }

  /** NCs cuja placa, item, motorista ou anotação contém o termo, sem diferenciar acentos e maiúsculas. */
  private async searchIds(term: string): Promise<string[]> {
    const tenantId = currentTenantId();
    const pattern = containsPattern(term);
    const platePattern = containsPattern(term.replace(/[^a-zA-Z0-9]/g, '') || term);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT n.id FROM "NonConformity" n
      LEFT JOIN "Vehicle" v ON v.id = n."vehicleId"
      LEFT JOIN "TemplateItem" i ON i.id = n."itemId"
      LEFT JOIN "ChecklistAnswer" a ON a.id = n."answerId"
      LEFT JOIN "Checklist" c ON c.id = a."checklistId"
      LEFT JOIN "Employee" e ON e.id = c."driverId"
      WHERE n."tenantId" = ${tenantId}
        AND (${plain('v."plate"')} LIKE ${platePattern}
          OR ${plain('i."text"')} LIKE ${pattern}
          OR ${plain('a."itemText"')} LIKE ${pattern}
          OR ${plain('e."name"')} LIKE ${pattern}
          OR ${plain('n."notes"')} LIKE ${pattern})
      LIMIT ${SEARCH_LIMIT}`;
    return rows.map((row) => row.id);
  }

  async update(id: string, updateNcDto: UpdateNcDto) {
    const record = await this.prisma.nonConformity.findUnique({
      where: { id },
      include: { answer: { include: { checklist: { select: { vehicleId: true } } } } },
    });
    if (!record) throw new NotFoundException('NC não encontrada');

    if (updateNcDto.status && !canTransitionNc(record.status, updateNcDto.status)) {
      throw new ConflictException('Esta NC já foi encerrada e não pode ser reaberta.');
    }

    const data: { status?: string; severity?: string; notes?: string; resolvedAt?: Date | null } = { ...updateNcDto };
    if (updateNcDto.status === 'RESOLVED' || updateNcDto.status === 'CLOSED') {
      data.resolvedAt = record.resolvedAt ?? new Date();
    } else if (updateNcDto.status && ACTIVE_NC_STATUSES.includes(updateNcDto.status)) {
      data.resolvedAt = null;
    }

    const vehicleId = record.vehicleId ?? record.answer?.checklist?.vehicleId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nonConformity.update({ where: { id }, data });

      // Mudou status ou severidade: o status do veículo passa a refletir as NCs ativas.
      if (vehicleId && (updateNcDto.status || updateNcDto.severity)) {
        const activeNcs = await tx.nonConformity.findMany({
          where: { vehicleId, status: { in: ACTIVE_NC_STATUSES } },
          select: { severity: true },
        });
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: vehicleStatusFromActiveNcs(activeNcs.map((nc) => nc.severity), await autoBlockCriticalNc(tx)) },
        });
      }

      return updated;
    });
  }
}
