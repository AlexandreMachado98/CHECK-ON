import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateEmInspectionDto, ReleaseEmDto } from './em.dto';
import { EM_RELEASE_MAX_DAYS, EM_WARN_DAYS, addDaysIso, effectiveVehicleStatus, emStatus, isoDay, todayIso } from './em-rules';

type Actor = { id: string };
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
const asDate = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`);

/**
 * Inspeção eletromecânica: laudos de cada veículo com a validade escrita no laudo. Vencida, o veículo
 * fica bloqueado em todo o sistema (portal, app, painel e página do passageiro) até registrarem uma
 * nova inspeção válida ou o gestor liberar provisoriamente, com justificativa e prazo.
 */
@Injectable()
export class ElectromechanicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async uploadPhoto(file: { buffer: Buffer; mimetype: string }) {
    return { photoUrl: await this.storage.uploadChecklistPhoto(file.buffer, file.mimetype, this.tenantId()) };
  }

  /** Ficha do veículo: situação, laudos e liberações provisórias. */
  async vehicle(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id },
      select: { id: true, plate: true, prefix: true, model: true, status: true, emExpiresAt: true, emReleasedUntil: true },
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const [inspections, releases] = await Promise.all([
      this.prisma.electromechanicalInspection.findMany({ where: { vehicleId: id }, orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.electromechanicalRelease.findMany({ where: { vehicleId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    const em = emStatus(vehicle.emExpiresAt, vehicle.emReleasedUntil);
    return {
      vehicle: { id: vehicle.id, plate: vehicle.plate, prefix: vehicle.prefix, model: vehicle.model, status: effectiveVehicleStatus(vehicle.status, em), operationalStatus: vehicle.status },
      em,
      warnDays: EM_WARN_DAYS,
      releaseMaxDays: EM_RELEASE_MAX_DAYS,
      inspections: inspections.map((i) => ({ ...i, performedAt: isoDay(i.performedAt), expiresAt: isoDay(i.expiresAt) })),
      releases: releases.map((r) => ({ ...r, until: isoDay(r.until) })),
    };
  }

  async create(dto: CreateEmInspectionDto, actor: Actor) {
    const tenantId = this.tenantId();
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const performed = dto.performedAt.slice(0, 10);
    const expires = dto.expiresAt.slice(0, 10);
    const today = todayIso();
    if (performed > today) throw new BadRequestException('A data da inspeção não pode ser no futuro.');
    if (expires <= performed) throw new BadRequestException('A validade precisa ser depois da data da inspeção.');
    if (expires > addDaysIso(performed, 5 * 366)) throw new BadRequestException('Validade de mais de 5 anos: confira a data do laudo.');
    let photoUrl: string | null = null;
    if (dto.photoUrl) {
      if (!this.storage.isChecklistPhotoUrl(dto.photoUrl, tenantId)) throw new BadRequestException('A foto do laudo não foi enviada por esta plataforma. Envie a foto de novo.');
      photoUrl = this.storage.canonicalUrl(dto.photoUrl);
    }
    const author = await this.prisma.user.findFirst({ where: { id: actor.id }, select: { name: true } });
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.electromechanicalInspection.create({
        data: {
          tenantId,
          vehicleId: vehicle.id,
          performedAt: asDate(performed),
          expiresAt: asDate(expires),
          provider: dto.provider?.trim() || null,
          reportNumber: dto.reportNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          photoUrl,
          createdById: actor.id,
          createdByName: author?.name ?? null,
        },
      });
      await this.recompute(tx, vehicle.id, today);
      return { ...created, performedAt: performed, expiresAt: expires };
    });
  }

  async remove(id: string) {
    const record = await this.prisma.electromechanicalInspection.findFirst({ where: { id }, select: { id: true, vehicleId: true } });
    if (!record) throw new NotFoundException('Inspeção não encontrada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.electromechanicalInspection.delete({ where: { id } });
      await this.recompute(tx, record.vehicleId, todayIso());
    });
    return { ok: true };
  }

  /** Liberação provisória: só com a inspeção vencida, com prazo de até 30 dias e justificativa. */
  async release(vehicleId: string, dto: ReleaseEmDto, actor: Actor) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId }, select: { id: true, emExpiresAt: true, emReleasedUntil: true } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const em = emStatus(vehicle.emExpiresAt, vehicle.emReleasedUntil);
    if (em.state !== 'VENCIDA' && em.state !== 'LIBERADA') throw new ConflictException('A inspeção eletromecânica deste veículo não está vencida.');
    const today = todayIso();
    const until = dto.until.slice(0, 10);
    if (until < today) throw new BadRequestException('A liberação precisa valer pelo menos até hoje.');
    if (until > addDaysIso(today, EM_RELEASE_MAX_DAYS)) throw new BadRequestException(`A liberação provisória vale no máximo ${EM_RELEASE_MAX_DAYS} dias. Registre a nova inspeção para liberar de vez.`);
    const author = await this.prisma.user.findFirst({ where: { id: actor.id }, select: { name: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.electromechanicalRelease.updateMany({ where: { vehicleId, endedAt: null }, data: { endedAt: new Date() } });
      await tx.electromechanicalRelease.create({
        data: { tenantId: this.tenantId(), vehicleId, until: asDate(until), reason: dto.reason.trim(), byId: actor.id, byName: author?.name ?? null },
      });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { emReleasedUntil: asDate(until) } });
    });
    return { ok: true, until };
  }

  /** Encerra a liberação provisória antes do prazo (o veículo volta a ficar bloqueado). */
  async endRelease(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    await this.prisma.$transaction(async (tx) => {
      await tx.electromechanicalRelease.updateMany({ where: { vehicleId, endedAt: null }, data: { endedAt: new Date() } });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { emReleasedUntil: null } });
    });
    return { ok: true };
  }

  /** Para o painel: vencidas (bloqueados), vencendo em até 15 dias e liberados provisoriamente. */
  async summary() {
    const today = todayIso();
    const t = asDate(today);
    const [expired, dueSoon, released] = await Promise.all([
      this.prisma.vehicle.count({ where: { isActive: true, emExpiresAt: { lt: t }, OR: [{ emReleasedUntil: null }, { emReleasedUntil: { lt: t } }] } }),
      this.prisma.vehicle.count({ where: { isActive: true, emExpiresAt: { gte: t, lte: asDate(addDaysIso(today, EM_WARN_DAYS)) } } }),
      this.prisma.vehicle.count({ where: { isActive: true, emExpiresAt: { lt: t }, emReleasedUntil: { gte: t } } }),
    ]);
    return { expired, dueSoon, released, warnDays: EM_WARN_DAYS };
  }

  /**
   * Validade vigente do veículo = a maior entre as inspeções. Com validade em dia de novo, a
   * liberação provisória deixa de ser necessária e é encerrada.
   */
  private async recompute(tx: Tx, vehicleId: string, today: string) {
    const { _max } = await tx.electromechanicalInspection.aggregate({ where: { vehicleId }, _max: { expiresAt: true } });
    const expiresAt = _max.expiresAt ?? null;
    const valid = !!expiresAt && isoDay(expiresAt)! >= today;
    await tx.vehicle.update({ where: { id: vehicleId }, data: { emExpiresAt: expiresAt, ...(valid ? { emReleasedUntil: null } : {}) } });
    if (valid) await tx.electromechanicalRelease.updateMany({ where: { vehicleId, endedAt: null }, data: { endedAt: new Date() } });
  }

  private tenantId(): string {
    const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
    if (!tenantId) throw new ForbiddenException('Sessão sem empresa associada.');
    return tenantId;
  }
}
