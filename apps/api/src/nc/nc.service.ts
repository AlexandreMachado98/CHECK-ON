import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { StorageService } from '../storage/storage.service';
import { CreateNcActionDto } from './dto/create-nc-action.dto';
import { resolutionError } from './nc-rules';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNcDto } from './dto/update-nc.dto';
import { itemAsAnswered, withAnsweredItem } from '../checklist/answer-snapshot';
import { ACTIVE_NC_STATUSES, canTransitionNc, vehicleStatusFromActiveNcs } from '../checklist/checklist-rules';
import { NcPageQueryDto, pageArgs } from '../common/pagination';
import { autoBlockCriticalNc } from '../company/company-settings';
import { SEARCH_LIMIT, containsPattern, currentTenantId, plain } from '../common/search-sql';
import { Prisma } from '@prisma/client';

/**
 * Lista de NCs (tela de NCs e painel): só o que as telas mostram. Antes vinham o cadastro inteiro do
 * veículo, do item, da inspeção e do motorista em cada linha (~3,5 KB por NC, ~180 KB por página);
 * o detalhe da NC (findOne) continua completo.
 */
const VEHICLE_IN_LIST = { select: { id: true, plate: true, model: true, status: true } } as const;
const ITEM_IN_LIST = { select: { id: true, text: true, type: true, isCritical: true } } as const;
const NC_LIST_INCLUDE = {
  vehicle: VEHICLE_IN_LIST,
  item: ITEM_IN_LIST,
  answer: {
    select: {
      id: true,
      checklistId: true,
      photoUrl: true,
      observations: true,
      // Cópia da pergunta no momento da resposta (o item pode ter mudado depois).
      itemText: true,
      itemType: true,
      itemIsCritical: true,
      categoryName: true,
      item: ITEM_IN_LIST,
      checklist: {
        select: {
          id: true,
          completedAt: true,
          vehicle: VEHICLE_IN_LIST,
          driver: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.NonConformityInclude;

/** Da mais grave para a menos grave. */
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const NC_INCLUDE = {
  vehicle: true,
  item: true,
  answer: { include: { item: true, checklist: { include: { vehicle: true, driver: true } } } },
} satisfies Prisma.NonConformityInclude;

@Injectable()
export class NcService {
  /**
   * Quantas reincidências cada NC tem (`_count.recurrences`), só para as NCs pedidas. O `_count` do
   * Prisma agruparia todas as respostas do banco a cada consulta.
   */
  private async withRecurrenceCount<T extends { id: string }>(ncs: T[]): Promise<(T & { _count: { recurrences: number } })[]> {
    const rows = ncs.length
      ? await this.prisma.checklistAnswer.groupBy({
          by: ['recurrentNcId'],
          where: { recurrentNcId: { in: ncs.map((nc) => nc.id) } },
          _count: { _all: true },
        })
      : [];
    const byNc = new Map(rows.map((row) => [row.recurrentNcId, row._count._all]));
    return ncs.map((nc) => ({ ...nc, _count: { recurrences: byNc.get(nc.id) ?? 0 } }));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly cls: ClsService,
  ) {}

  /** NC com a tratativa completa: foto do problema, histórico de ações e reincidências. */
  async findOne(id: string) {
    const nc = await this.prisma.nonConformity.findFirst({
      where: { id },
      include: {
        ...NC_INCLUDE,
        actions: { orderBy: { createdAt: 'asc' } },
        recurrences: {
          select: { id: true, photoUrl: true, observations: true, createdAt: true, checklist: { select: { completedAt: true, driver: { select: { name: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!nc) throw new NotFoundException('NC não encontrada');
    return {
      ...nc,
      _count: { recurrences: nc.recurrences.length },
      item: itemAsAnswered(nc.item, nc.answer),
      answer: nc.answer ? withAnsweredItem(nc.answer) : nc.answer,
    };
  }

  /** Foto da tratativa: guardada na pasta de fotos da empresa (sai junto se a empresa for excluída). */
  async uploadPhoto(file: { buffer: Buffer; mimetype: string }) {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) throw new ForbiddenException('Contexto de empresa ausente.');
    return { photoUrl: await this.storage.uploadChecklistPhoto(file.buffer, file.mimetype, tenantId) };
  }

  /**
   * Registro da tratativa: texto, fotos e/ou nova situação, com quem fez.
   * Resolver exige descrever o que foi feito; NC crítica exige foto da correção.
   */
  async addAction(id: string, dto: CreateNcActionDto, userId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const record = await this.prisma.nonConformity.findFirst({
      where: { id },
      include: { answer: { include: { checklist: { select: { vehicleId: true } } } }, actions: { select: { photoUrls: true } } },
    });
    if (!record) throw new NotFoundException('NC não encontrada');
    if (record.status === 'CLOSED') throw new ConflictException('Esta NC foi encerrada e não pode mais ser alterada.');

    const text = dto.text?.trim() || null;
    const photos = (dto.photoUrls ?? []).filter(Boolean);
    for (const url of photos) {
      if (!this.storage.isChecklistPhotoUrl(url, tenantId)) throw new BadRequestException('Uma das fotos não foi enviada por esta plataforma. Envie a foto de novo.');
    }
    const status = dto.status && dto.status !== record.status ? dto.status : null;
    if (!text && !photos.length && !status) {
      throw new BadRequestException('Descreva o que foi feito, anexe uma foto ou mude a situação.');
    }
    if (status && !canTransitionNc(record.status, status)) {
      throw new ConflictException('Esta NC já foi encerrada e não pode ser reaberta.');
    }
    const error = resolutionError({
      fromStatus: record.status,
      toStatus: status,
      severity: record.severity,
      text,
      hasTreatmentPhoto: photos.length > 0 || record.actions.some((a) => a.photoUrls.length > 0),
    });
    if (error) throw new BadRequestException(error);

    const user = await this.prisma.user.findFirst({ where: { id: userId }, select: { name: true } });
    const vehicleId = record.vehicleId ?? record.answer?.checklist?.vehicleId;

    await this.prisma.$transaction(async (tx) => {
      if (status || text) {
        const data: { status?: string; notes?: string; resolvedAt?: Date | null } = {};
        if (text) data.notes = text; // o último parecer continua aparecendo na lista e na busca
        if (status) {
          data.status = status;
          data.resolvedAt = ['RESOLVED', 'CLOSED'].includes(status) ? record.resolvedAt ?? new Date() : null;
        }
        await tx.nonConformity.update({ where: { id }, data });
      }
      await tx.ncAction.create({
        data: {
          ncId: id,
          userId,
          userName: user?.name ?? 'Usuário',
          fromStatus: status ? record.status : null,
          toStatus: status,
          text,
          photoUrls: photos.map((url) => this.storage.canonicalUrl(url)),
        } as never,
      });
      if (status && vehicleId) await this.refreshVehicleStatus(tx, vehicleId);
    });
    return this.findOne(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cliente da transação com a extensão de empresa
  private async refreshVehicleStatus(tx: any, vehicleId: string) {
    const activeNcs = await tx.nonConformity.findMany({
      where: { vehicleId, status: { in: ACTIVE_NC_STATUSES } },
      select: { severity: true },
    });
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: { status: vehicleStatusFromActiveNcs(activeNcs.map((nc: { severity: string }) => nc.severity), await autoBlockCriticalNc(tx)) },
    });
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
      query.sort === 'severity'
        ? this.findBySeverity(where, skip, take)
        : this.prisma.nonConformity.findMany({ where, include: NC_LIST_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.nonConformity.count({ where }),
      this.prisma.nonConformity.count({ where: active }),
      this.prisma.nonConformity.count({ where: { ...active, severity: 'CRITICAL' } }),
      this.prisma.nonConformity.count({ where: { ...active, occurrences: { gt: 1 } } }),
    ]);
    return {
      items: (await this.withRecurrenceCount(ncs)).map((nc) => ({
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

  /**
   * Mais graves primeiro. A gravidade é texto no banco (ordem alfabética não serve), então busca
   * gravidade por gravidade, só o que falta para completar a página.
   */
  private async findBySeverity(where: Prisma.NonConformityWhereInput, skip: number, take: number) {
    const found: Prisma.NonConformityGetPayload<{ include: typeof NC_LIST_INCLUDE }>[] = [];
    let toSkip = skip;
    for (const severity of SEVERITY_ORDER) {
      if (found.length >= take) break;
      if (where.severity && where.severity !== severity) continue;
      const scoped = { ...where, severity };
      if (toSkip > 0) {
        const count = await this.prisma.nonConformity.count({ where: scoped });
        if (count <= toSkip) {
          toSkip -= count;
          continue;
        }
      }
      found.push(
        ...(await this.prisma.nonConformity.findMany({
          where: scoped,
          include: NC_LIST_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip: toSkip,
          take: take - found.length,
        })),
      );
      toSkip = 0;
    }
    return found;
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

  async update(id: string, updateNcDto: UpdateNcDto, userId?: string) {
    const record = await this.prisma.nonConformity.findUnique({
      where: { id },
      include: { answer: { include: { checklist: { select: { vehicleId: true } } } }, actions: { select: { photoUrls: true } } },
    });
    if (!record) throw new NotFoundException('NC não encontrada');

    if (updateNcDto.status && !canTransitionNc(record.status, updateNcDto.status)) {
      throw new ConflictException('Esta NC já foi encerrada e não pode ser reaberta.');
    }

    // As mesmas regras da tratativa valem aqui (ninguém resolve NC crítica sem foto por outro caminho).
    const error = resolutionError({
      fromStatus: record.status,
      toStatus: updateNcDto.status,
      severity: updateNcDto.severity ?? record.severity,
      text: updateNcDto.notes ?? record.notes,
      hasTreatmentPhoto: record.actions.some((a) => a.photoUrls.length > 0),
    });
    if (error) throw new BadRequestException(error);

    const data: { status?: string; severity?: string; notes?: string; resolvedAt?: Date | null } = { ...updateNcDto };
    if (updateNcDto.status === 'RESOLVED' || updateNcDto.status === 'CLOSED') {
      data.resolvedAt = record.resolvedAt ?? new Date();
    } else if (updateNcDto.status && ACTIVE_NC_STATUSES.includes(updateNcDto.status)) {
      data.resolvedAt = null;
    }

    const vehicleId = record.vehicleId ?? record.answer?.checklist?.vehicleId;

    const user = userId ? await this.prisma.user.findFirst({ where: { id: userId }, select: { name: true } }) : null;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nonConformity.update({ where: { id }, data });
      const statusChanged = updateNcDto.status && updateNcDto.status !== record.status;
      const severityChanged = updateNcDto.severity && updateNcDto.severity !== record.severity;
      if (statusChanged || severityChanged) {
        await tx.ncAction.create({
          data: {
            ncId: id,
            userId: userId ?? null,
            userName: user?.name ?? 'Usuário',
            fromStatus: statusChanged ? record.status : null,
            toStatus: statusChanged ? updateNcDto.status : null,
            text: severityChanged ? `Severidade alterada de ${record.severity} para ${updateNcDto.severity}.` : null,
            photoUrls: [],
          } as never,
        });
      }

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
