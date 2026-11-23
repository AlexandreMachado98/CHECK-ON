import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { autoBlockCriticalNc } from '../company/company-settings';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SubmitChecklistDto } from './dto/submit-checklist.dto';
import {
  ACTIVE_NC_STATUSES,
  escalateVehicleStatus,
  itemsForVersion,
  maxSeverity,
  severityFor,
  validateAnswers,
  validateTimestamps,
  vehicleStatusFromActiveNcs,
} from './checklist-rules';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
  /** Aparelho que enviou (cabeçalho X-Device-Info do aplicativo), para auditoria. */
  deviceInfo?: string | null;
}

export type SubmitResult =
  | {
      status: 'CREATED';
      clientId: string;
      checklistId: string;
      ncsOpened: number;
      ncsRecurrent: number;
      vehicleStatus: string;
    }
  | { status: 'DUPLICATE'; clientId: string; checklistId: string };

export type SyncItemResult =
  | SubmitResult
  | { status: 'REJECTED'; clientId: string; message: string } // erro de dados: não adianta reenviar
  | { status: 'RETRY'; clientId: string; message: string }; // falha temporária: o app deve tentar de novo

/** Perfis que podem registrar checklist em nome de outro motorista. */
const MANAGER_ROLES = ['ADMIN_EMPRESA', 'GESTOR', 'SUPERVISOR'];

/**
 * Envio de inspeção: no pico da manhã muitos envios chegam juntos e disputam as poucas conexões do
 * banco (5 por instância em produção). Esperar até 10 s por uma conexão é melhor do que devolver
 * "erro temporário" e o app reenviar depois; 20 s cobre uma inspeção grande com o banco distante.
 */
export const SUBMIT_TRANSACTION = { maxWait: 10_000, timeout: 20_000 } as const;

@Injectable()
export class ChecklistExecutionService {
  private readonly logger = new Logger(ChecklistExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly storage: StorageService,
  ) {}

  /** Recebe a foto antes do checklist. O app guarda a URL devolvida e a envia na resposta do item. */
  async uploadPhoto(file: { buffer: Buffer; mimetype: string }) {
    const tenantId = this.requireTenant();
    const photoUrl = await this.storage.uploadChecklistPhoto(file.buffer, file.mimetype, tenantId);
    return { photoUrl };
  }

  async submit(dto: SubmitChecklistDto, user: AuthenticatedUser): Promise<SubmitResult> {
    const tenantId = this.requireTenant();

    const existing = await this.findByClientId(tenantId, dto.clientId);
    if (existing) return { status: 'DUPLICATE', clientId: dto.clientId, checklistId: existing.id };

    const driverId = await this.resolveDriverId(dto, user);
    const completedAt = new Date(dto.completedAt);
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : completedAt;
    const timeErrors = validateTimestamps(startedAt, completedAt);
    if (timeErrors.length) throw new UnprocessableEntityException(timeErrors);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const template = await tx.template.findFirst({
          where: { id: dto.templateId, isActive: true },
          include: { categories: { include: { items: true } }, units: { select: { unitId: true } } },
        });
        if (!template) throw new NotFoundException('Template não encontrado ou inativo.');

        const vehicle = await tx.vehicle.findFirst({ where: { id: dto.vehicleId, isActive: true }, include: { fleet: { select: { unitId: true } } } });
        if (!vehicle) throw new NotFoundException('Veículo não encontrado ou inativo.');
        // Modelo de algumas frentes só vale nos veículos delas (o motorista pode estar em várias frentes).
        if (!template.allUnits && !template.units.some((unit) => unit.unitId === vehicle.fleet.unitId)) {
          throw new UnprocessableEntityException(['Este checklist não vale para a frente de trabalho deste veículo.']);
        }

        const driver = await tx.employee.findFirst({ where: { id: driverId, isActive: true } });
        if (!driver) throw new NotFoundException('Motorista não encontrado ou inativo.');

        // Checklist feito offline pode ter usado uma versão anterior do modelo.
        const templateVersion = Math.min(dto.templateVersion ?? template.version, template.version);
        const items = itemsForVersion(
          template.categories.flatMap((category) =>
            category.items.map((item) => ({
              ...item,
              isActive: item.isActive && category.isActive,
              categoryName: category.name,
            })),
          ),
          templateVersion,
        );
        const itemsById = new Map(items.map((item) => [item.id, item]));
        const { errors, answers } = validateAnswers(items, dto.answers);
        for (const answer of answers) {
          if (answer.photoUrl && !this.storage.isChecklistPhotoUrl(answer.photoUrl, tenantId)) {
            errors.push(`A foto do item "${itemsById.get(answer.itemId)?.text}" não foi enviada por esta plataforma. Envie a foto novamente.`);
          } else if (answer.photoUrl) {
            // O app pode devolver o endereço de exibição (/fotos/...): grava sempre o do armazenamento.
            answer.photoUrl = this.storage.canonicalUrl(answer.photoUrl);
          }
        }
        // Assinatura: mesma regra das fotos (só imagem enviada por esta plataforma, desta empresa).
        let signatureUrl: string | null = null;
        if (dto.signatureUrl) {
          if (!this.storage.isChecklistPhotoUrl(dto.signatureUrl, tenantId)) {
            errors.push('A assinatura não foi enviada por esta plataforma. Assine novamente.');
          } else {
            signatureUrl = this.storage.canonicalUrl(dto.signatureUrl);
          }
        }
        if (errors.length) throw new UnprocessableEntityException(errors);

        const checklist = await tx.checklist.create({
          data: {
            tenantId,
            clientId: dto.clientId,
            templateId: template.id,
            templateVersion,
            templateName: template.name,
            vehicleId: vehicle.id,
            driverId: driver.id,
            status: 'COMPLETED',
            startedAt,
            completedAt,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            deviceInfo: user.deviceInfo ?? null,
            signatureUrl,
            signedName: signatureUrl ? dto.signedName?.trim() || driver.name : null,
            syncedAt: new Date(),
          },
        });

        let ncsOpened = 0;
        let ncsRecurrent = 0;

        // NCs ativas do veículo numa consulta só: a constatação de um item que já tem NC ativa é
        // reincidência (agrupa na NC existente em vez de abrir outra).
        const activeNcByItem = new Map<string, { id: string; severity: string }>();
        for (const nc of await tx.nonConformity.findMany({
          where: { vehicleId: vehicle.id, status: { in: ACTIVE_NC_STATUSES } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, itemId: true, severity: true },
        })) {
          if (nc.itemId && !activeNcByItem.has(nc.itemId)) activeNcByItem.set(nc.itemId, nc);
        }

        // Todas as respostas num comando só (antes: uma ida ao banco por item). Com o banco longe da
        // API, 40 idas seguidas seguravam a conexão por segundos e o pico da manhã esgotava o pool.
        // O id é gerado aqui para ligar as NCs novas às respostas sem precisar ler de volta.
        const rows = answers.map((answer) => {
          const item = itemsById.get(answer.itemId)!;
          const recurrent = !answer.isCompliant ? activeNcByItem.get(item.id) : undefined;
          return {
            id: randomUUID(),
            tenantId,
            checklistId: checklist.id,
            ...answer,
            // Cópia da pergunta: editar o modelo depois não muda o que foi respondido.
            itemText: item.text,
            itemType: item.type,
            itemIsCritical: item.isCritical,
            categoryName: item.categoryName,
            recurrentNcId: recurrent?.id ?? null,
          };
        });
        await tx.checklistAnswer.createMany({ data: rows });

        // Só os itens com problema (poucos por inspeção): reincidência atualiza a NC; senão abre uma.
        for (const answer of rows) {
          if (answer.isCompliant) continue;
          const item = itemsById.get(answer.itemId)!;
          const severity = severityFor(item);
          const activeNc = activeNcByItem.get(item.id);
          if (activeNc) {
            await tx.nonConformity.update({
              where: { id: activeNc.id },
              data: {
                occurrences: { increment: 1 },
                lastOccurrenceAt: completedAt,
                severity: maxSeverity(activeNc.severity, severity),
              },
            });
            ncsRecurrent++;
          } else {
            await tx.nonConformity.create({
              data: {
                tenantId,
                answerId: answer.id,
                vehicleId: vehicle.id,
                itemId: item.id,
                severity,
                status: 'OPEN',
                lastOccurrenceAt: completedAt,
              },
            });
            ncsOpened++;
          }
        }

        // Na chegada de um checklist o status do veículo só piora.
        const activeNcs = await tx.nonConformity.findMany({
          where: { vehicleId: vehicle.id, status: { in: ACTIVE_NC_STATUSES } },
          select: { severity: true },
        });
        const vehicleStatus = escalateVehicleStatus(
          vehicle.status,
          vehicleStatusFromActiveNcs(activeNcs.map((nc) => nc.severity), await autoBlockCriticalNc(tx, tenantId)),
        );
        if (vehicleStatus !== vehicle.status) {
          await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: vehicleStatus } });
        }

        return {
          status: 'CREATED' as const,
          clientId: dto.clientId,
          checklistId: checklist.id,
          ncsOpened,
          ncsRecurrent,
          vehicleStatus,
        };
      }, SUBMIT_TRANSACTION);
    } catch (error) {
      // Dois envios simultâneos do mesmo clientId: o segundo esbarra no índice único.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.findByClientId(tenantId, dto.clientId);
        if (duplicate) return { status: 'DUPLICATE', clientId: dto.clientId, checklistId: duplicate.id };
      }
      throw error;
    }
  }

  /** Processa um lote vindo do app. Cada item é independente: um erro não derruba os demais. */
  async sync(dtos: SubmitChecklistDto[], user: AuthenticatedUser): Promise<SyncItemResult[]> {
    const results: SyncItemResult[] = [];
    for (const dto of dtos) {
      try {
        results.push(await this.submit(dto, user));
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() < 500) {
          results.push({ status: 'REJECTED', clientId: dto.clientId, message: this.messageOf(error) });
        } else {
          this.logger.error(`Falha ao sincronizar checklist ${dto.clientId}`, error as Error);
          results.push({ status: 'RETRY', clientId: dto.clientId, message: 'Erro temporário no servidor.' });
        }
      }
    }
    return results;
  }

  private async resolveDriverId(dto: SubmitChecklistDto, user: AuthenticatedUser): Promise<string> {
    if (dto.driverId && MANAGER_ROLES.includes(user.role)) return dto.driverId;

    const account = await this.prisma.user.findFirst({ where: { id: user.id }, select: { employeeId: true } });
    const ownEmployeeId = account?.employeeId;
    if (!ownEmployeeId) {
      throw new BadRequestException('Seu usuário não está vinculado a um funcionário. Peça ao gestor para fazer o vínculo.');
    }
    if (dto.driverId && dto.driverId !== ownEmployeeId) {
      throw new ForbiddenException('Você só pode registrar checklists em seu próprio nome.');
    }
    return ownEmployeeId;
  }

  private findByClientId(tenantId: string, clientId: string) {
    return this.prisma.checklist.findFirst({ where: { tenantId, clientId }, select: { id: true } });
  }

  private requireTenant(): string {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) throw new ForbiddenException('Contexto de empresa ausente.');
    return tenantId;
  }

  private messageOf(error: HttpException): string {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    const message = (response as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join(' ') : message ?? error.message;
  }
}
