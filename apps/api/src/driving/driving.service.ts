import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ClsServiceManager } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimiter } from '../common/rate-limit';
import { dashboardTimeZone, startOfDayInTimeZone } from '../dashboard/time-zone';
import { PassengerQrDto, SubmitDrivingFeedbackDto, TreatDrivingFeedbackDto } from './dto/driving.dto';
import { DRIVING_TAGS, PASSENGER_TOKEN_PATTERN, REPEAT_WINDOW_HOURS, isAlert, shortName } from './driving-rules';

/** Envios por IP na janela: sobra para um ônibus cheio no mesmo Wi-Fi, barra robô. */
const IP_MAX = 60;
const IP_WINDOW_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type DriverOption = { checklistId: string; driverName: string; plate: string; prefix: string | null; model: string | null; completedAt: Date | null };
type Actor = { id: string };

/**
 * "Como estou dirigindo": o passageiro lê o QR dentro do veículo e avalia quem está dirigindo.
 * O motorista é quem fez o checklist do veículo hoje; a página também lista os motoristas que
 * inspecionaram veículos da mesma frente hoje, para quando outra pessoa assumiu o volante.
 */
@Injectable()
export class DrivingService {
  private readonly ipLimiter: RateLimiter;

  constructor(private readonly prisma: PrismaService) {
    this.ipLimiter = new RateLimiter(prisma, IP_MAX, IP_WINDOW_MS);
  }

  // ── Página pública (sem login: toda consulta filtra a empresa pelo veículo) ──

  async publicVehicle(token: string) {
    const vehicle = await this.findByToken(token);
    const drivers = await this.driversToday(vehicle);
    const current = drivers.find((d) => d.vehicleId === vehicle.id) ?? null;
    return {
      companyName: vehicle.tenant.name,
      vehicle: { plate: vehicle.plate, prefix: vehicle.prefix, model: vehicle.model },
      current: current && this.option(current),
      others: drivers.filter((d) => d !== current).map((d) => this.option(d)),
      tags: DRIVING_TAGS,
    };
  }

  async submit(token: string, dto: SubmitDrivingFeedbackDto, ip: string | undefined) {
    const ipKey = `driving-ip:${ip ?? 'desconhecido'}`;
    if (await this.ipLimiter.isBlocked(ipKey)) {
      throw new HttpException('Muitas avaliações enviadas desta rede. Tente de novo mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const vehicle = await this.findByToken(token);
    let checklist: { id: string; driverId: string } | null = null;
    if (dto.checklistId) {
      const drivers = await this.driversToday(vehicle);
      const chosen = drivers.find((d) => d.id === dto.checklistId);
      if (!chosen) throw new BadRequestException('Este motorista não aparece mais na lista de hoje. Atualize a página e escolha de novo.');
      checklist = { id: chosen.id, driverId: chosen.driverId };
    }
    const tags = [...new Set(dto.tags ?? [])];
    const deviceHash = dto.deviceId ? createHash('sha256').update(`${vehicle.tenantId}:${dto.deviceId}`).digest('hex') : null;
    if (deviceHash) {
      const recent = await this.prisma.drivingFeedback.findFirst({
        where: {
          tenantId: vehicle.tenantId,
          deviceHash,
          createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_HOURS * 60 * 60 * 1000) },
          ...(checklist ? { driverId: checklist.driverId } : { vehicleId: vehicle.id, driverId: null }),
        },
        select: { id: true },
      });
      if (recent) throw new HttpException('Você já avaliou este motorista há pouco. Obrigado! Uma nova avaliação fica liberada mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.ipLimiter.hit(ipKey);
    await this.prisma.drivingFeedback.create({
      data: {
        tenantId: vehicle.tenantId,
        vehicleId: vehicle.id,
        checklistId: checklist?.id ?? null,
        driverId: checklist?.driverId ?? null,
        rating: dto.rating,
        tags,
        comment: dto.comment?.trim() || null,
        contact: dto.contact?.trim() || null,
        alert: isAlert(dto.rating, tags),
        deviceHash,
      },
    });
    return { ok: true };
  }

  // ── Gestão (portal) ───────────────────────────────────────────────────────

  /** Avaliações do período, com o ranking por motorista. Só as dos veículos das frentes de quem pede. */
  async list(query: { days?: string; status?: string; alerts?: string; driverId?: string }) {
    const days = [7, 30, 90, 365].includes(Number(query.days)) ? Number(query.days) : 30;
    const since = new Date(Date.now() - days * DAY_MS);
    const period = { createdAt: { gte: since } };
    const filter = {
      ...period,
      ...(query.status === 'OPEN' ? { status: { not: 'TRATADA' } } : query.status === 'TRATADA' ? { status: 'TRATADA' } : {}),
      ...(query.alerts === 'true' ? { alert: true } : {}),
      ...(query.driverId ? { driverId: query.driverId === 'none' ? null : query.driverId } : {}),
    };
    const [items, byDriver, alertsByDriver, totals, openAlerts] = await Promise.all([
      this.prisma.drivingFeedback.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: {
          vehicle: { select: { id: true, plate: true, prefix: true, model: true } },
          driver: { select: { id: true, name: true, matricula: true } },
          checklist: { select: { id: true, completedAt: true } },
        },
      }),
      this.prisma.drivingFeedback.groupBy({ by: ['driverId'], where: period, _avg: { rating: true }, _count: { _all: true }, _max: { createdAt: true } }),
      this.prisma.drivingFeedback.groupBy({ by: ['driverId'], where: { ...period, alert: true, status: { not: 'TRATADA' } }, _count: { _all: true } }),
      this.prisma.drivingFeedback.aggregate({ where: period, _avg: { rating: true }, _count: { _all: true } }),
      this.prisma.drivingFeedback.count({ where: { alert: true, status: { not: 'TRATADA' } } }),
    ]);
    const ids = byDriver.map((d) => d.driverId).filter((id): id is string => !!id);
    const employees = ids.length ? await this.prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, matricula: true } }) : [];
    const names = new Map(employees.map((e) => [e.id, e]));
    const openByDriver = new Map(alertsByDriver.map((a) => [a.driverId, a._count._all]));
    const drivers = byDriver
      .map((d) => ({
        driverId: d.driverId,
        name: d.driverId ? names.get(d.driverId)?.name ?? 'Motorista removido' : 'Motorista não identificado',
        matricula: d.driverId ? names.get(d.driverId)?.matricula ?? null : null,
        count: d._count._all,
        average: Math.round((d._avg.rating ?? 0) * 10) / 10,
        openAlerts: openByDriver.get(d.driverId) ?? 0,
        lastAt: d._max.createdAt,
      }))
      // Quem tem alerta aberto primeiro; depois a menor média.
      .sort((a, b) => b.openAlerts - a.openAlerts || a.average - b.average || b.count - a.count);
    return {
      days,
      summary: { count: totals._count._all, average: Math.round((totals._avg.rating ?? 0) * 10) / 10, openAlerts },
      drivers,
      items: items.map(({ deviceHash: _hidden, ...item }) => item),
      tags: DRIVING_TAGS,
    };
  }

  /** Contagem para o painel: alertas sem tratativa. */
  async summary() {
    const openAlerts = await this.prisma.drivingFeedback.count({ where: { alert: true, status: { not: 'TRATADA' } } });
    return { openAlerts };
  }

  async treat(id: string, dto: TreatDrivingFeedbackDto, actor: Actor) {
    const item = await this.prisma.drivingFeedback.findFirst({ where: { id }, select: { id: true } });
    if (!item) throw new NotFoundException('Avaliação não encontrada.');
    const treatment = dto.treatment?.trim() || null;
    if (dto.status === 'TRATADA' && (!treatment || treatment.length < 5)) {
      throw new BadRequestException('Descreva o que foi feito (conversa com o motorista, treinamento...) para marcar como tratada.');
    }
    const author = dto.status === 'TRATADA' ? await this.prisma.user.findFirst({ where: { id: actor.id }, select: { name: true } }) : null;
    return this.prisma.drivingFeedback.update({
      where: { id },
      data: {
        status: dto.status,
        treatment,
        treatedAt: dto.status === 'TRATADA' ? new Date() : null,
        treatedByName: dto.status === 'TRATADA' ? author?.name ?? null : null,
      },
    });
  }

  /** Código do QR do passageiro dos veículos: cria o que falta (ou troca todos, com rotate). */
  async passengerQr(dto: PassengerQrDto) {
    const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
    if (!tenantId) throw new UnauthorizedException('Sessão sem empresa associada.');
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: [...new Set(dto.vehicleIds)] } },
      select: { id: true, plate: true, prefix: true, passengerToken: true },
    });
    if (!vehicles.length) throw new NotFoundException('Nenhum veículo encontrado.');
    const result: { id: string; plate: string; prefix: string | null; passengerToken: string }[] = [];
    for (const v of vehicles) {
      if (v.passengerToken && !dto.rotate) {
        result.push({ ...v, passengerToken: v.passengerToken });
        continue;
      }
      const passengerToken = randomBytes(24).toString('base64url');
      await this.prisma.vehicle.update({ where: { id: v.id }, data: { passengerToken } });
      result.push({ ...v, passengerToken });
    }
    return result;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private async findByToken(token: string) {
    if (!PASSENGER_TOKEN_PATTERN.test(token)) throw new NotFoundException('Este QR Code não é válido ou foi trocado.');
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { passengerToken: token, isActive: true, tenant: { isActive: true } },
      select: { id: true, tenantId: true, plate: true, prefix: true, model: true, fleet: { select: { unitId: true } }, tenant: { select: { name: true } } },
    });
    if (!vehicle) throw new NotFoundException('Este QR Code não é válido ou foi trocado.');
    return vehicle;
  }

  /**
   * Motoristas com inspeção concluída hoje (fuso do painel) em veículos da mesma frente: a mais
   * recente de cada motorista. O motorista atual do veículo é o da inspeção mais recente dele.
   */
  private async driversToday(vehicle: { id: string; tenantId: string; fleet: { unitId: string } }) {
    const since = startOfDayInTimeZone(new Date(), dashboardTimeZone());
    const checklists = await this.prisma.checklist.findMany({
      where: {
        tenantId: vehicle.tenantId,
        completedAt: { gte: since },
        vehicle: { isActive: true, fleet: { unitId: vehicle.fleet.unitId } },
        driver: { isActive: true },
      },
      orderBy: { completedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        vehicleId: true,
        driverId: true,
        completedAt: true,
        driver: { select: { name: true } },
        vehicle: { select: { plate: true, prefix: true, model: true } },
      },
    });
    // O veículo do QR: vale a inspeção mais recente dele, mesmo que o motorista tenha inspecionado
    // outro depois. Dos demais motoristas, a inspeção mais recente de cada um.
    const ownLatest = checklists.find((c) => c.vehicleId === vehicle.id);
    const seen = new Set<string>(ownLatest ? [ownLatest.driverId] : []);
    const others: typeof checklists = [];
    for (const c of checklists) {
      if (seen.has(c.driverId)) continue;
      seen.add(c.driverId);
      others.push(c);
    }
    others.sort((a, b) => a.driver.name.localeCompare(b.driver.name, 'pt-BR'));
    return ownLatest ? [ownLatest, ...others] : others;
  }

  private option(c: { id: string; completedAt: Date | null; driver: { name: string }; vehicle: { plate: string; prefix: string | null; model: string | null } }): DriverOption {
    return { checklistId: c.id, driverName: shortName(c.driver.name), plate: c.vehicle.plate, prefix: c.vehicle.prefix, model: c.vehicle.model, completedAt: c.completedAt };
  }
}
