import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ACTIVE_NC_STATUSES, vehicleStatusFromActiveNcs } from './checklist-rules';
import { autoBlockCriticalNc } from '../company/company-settings';
import { withAnsweredItem } from './answer-snapshot';
import { ChecklistPageQueryDto, Page, pageArgs } from '../common/pagination';
import { SEARCH_LIMIT, containsPattern, currentTenantId, plain } from '../common/search-sql';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChecklistService {
  private readonly logger = new Logger('Inspecoes');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
        // Frota e frente de trabalho: aparecem nos detalhes e no PDF da inspeção.
        vehicle: { include: { fleet: { select: { id: true, name: true, unit: { select: { id: true, name: true, client: true } } } } } },
        driver: true,
        answers: { include: { item: true, nonConformity: true } }
      }
    });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return { ...record, answers: record.answers.map(withAnsweredItem) };
  }

  /**
   * Exclui a inspeção com as respostas e as NCs abertas por ela (cascata no banco) e apaga do
   * armazenamento as fotos dessas respostas e das tratativas: sem isso elas ficavam na nuvem,
   * acessíveis pelo endereço, sem registro nenhum que as usasse.
   * Se a inspeção tinha NC ativa, a situação do veículo é recalculada (ex.: deixa de ficar bloqueado).
   */
  async remove(id: string) {
    const record = await this.prisma.checklist.findFirst({
      where: { id },
      select: {
        id: true,
        vehicleId: true,
        signatureUrl: true,
        answers: {
          select: {
            photoUrl: true,
            nonConformity: { select: { status: true, actions: { select: { photoUrls: true } } } },
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Registro não encontrado');

    const photos = [
      ...(record.signatureUrl ? [record.signatureUrl] : []),
      ...record.answers.flatMap((answer) => [
        ...(answer.photoUrl ? [answer.photoUrl] : []),
        ...(answer.nonConformity?.actions.flatMap((action) => action.photoUrls) ?? []),
      ]),
    ];
    const hadActiveNc = record.answers.some((answer) => answer.nonConformity && ACTIVE_NC_STATUSES.includes(answer.nonConformity.status));

    const deleted = await this.prisma.$transaction(async (tx) => {
      const removed = await tx.checklist.delete({ where: { id } });
      if (hadActiveNc) {
        const active = await tx.nonConformity.findMany({
          where: { vehicleId: record.vehicleId, status: { in: ACTIVE_NC_STATUSES } },
          select: { severity: true },
        });
        await tx.vehicle.update({
          where: { id: record.vehicleId },
          data: { status: vehicleStatusFromActiveNcs(active.map((nc) => nc.severity), await autoBlockCriticalNc(tx)) },
        });
      }
      return removed;
    });

    // Depois de confirmar a exclusão: uma foto que falhe ao apagar não desfaz nada.
    for (const url of new Set(photos)) {
      await this.storage.deleteFile(url).catch((error: Error) => this.logger.warn(`Foto não apagada (${url}): ${error.message}`));
    }
    return deleted;
  }
}
