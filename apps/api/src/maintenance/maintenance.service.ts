import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { currentUnitIds } from '../common/unit-scope';
import { CreateMaintenancePlanDto, UpdateMaintenancePlanDto } from './dto/maintenance-plan.dto';
import { CreateMaintenanceRecordDto } from './dto/maintenance-record.dto';
import { LastDone, PlanLike, STATE_ORDER, VehicleMaintenanceState, byUrgency, planStatus, worstState } from './maintenance-status';

type ScopedPlan = PlanLike & { fleetId: string | null };
type Actor = { id: string };

const VEHICLE_SELECT = {
  id: true,
  plate: true,
  prefix: true,
  brand: true,
  model: true,
  mileage: true,
  status: true,
  fleetId: true,
  fleet: { select: { id: true, name: true, unit: { select: { id: true, name: true } } } },
} as const;

/** O plano vale para o veículo: plano da empresa toda ou da frota dele. */
const appliesTo = (plan: { fleetId: string | null }, vehicle: { fleetId: string }) => plan.fleetId === null || plan.fleetId === vehicle.fleetId;
const key = (vehicleId: string, planId: string) => `${vehicleId}:${planId}`;

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Planos ────────────────────────────────────────────────────────────────

  async listPlans() {
    const plans = await this.prisma.maintenancePlan.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
      include: { fleet: { select: { id: true, name: true, unit: { select: { name: true } } } } },
    });
    const sees = currentUnitIds() === null;
    // Plano da empresa toda: quem é limitado a algumas frentes consulta, mas só o administrador altera.
    return plans.map((plan) => ({ ...plan, canEdit: sees || plan.fleetId !== null }));
  }

  async createPlan(dto: CreateMaintenancePlanDto) {
    const fleetId = await this.resolveFleet(dto.fleetId ?? null);
    this.assertWarn(dto.warnBeforeKm, dto.intervalKm);
    return this.prisma.maintenancePlan.create({
      data: {
        tenantId: this.tenantId(),
        name: dto.name.trim(),
        intervalKm: dto.intervalKm,
        intervalDays: dto.intervalDays ?? null,
        warnBeforeKm: dto.warnBeforeKm ?? Math.min(1000, Math.round(dto.intervalKm / 10)),
        fleetId,
      },
    });
  }

  async updatePlan(id: string, dto: UpdateMaintenancePlanDto) {
    const plan = await this.findPlan(id);
    this.assertCanEdit(plan);
    const fleetId = dto.fleetId !== undefined ? await this.resolveFleet(dto.fleetId) : undefined;
    this.assertWarn(dto.warnBeforeKm ?? plan.warnBeforeKm, dto.intervalKm ?? plan.intervalKm);
    return this.prisma.maintenancePlan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        intervalKm: dto.intervalKm,
        intervalDays: dto.intervalDays,
        warnBeforeKm: dto.warnBeforeKm,
        fleetId,
        isActive: dto.isActive,
      },
    });
  }

  /** Desativa: some da lista e da situação dos veículos; o histórico das manutenções feitas fica. */
  async removePlan(id: string) {
    const plan = await this.findPlan(id);
    this.assertCanEdit(plan);
    await this.prisma.maintenancePlan.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  // ── Situação ──────────────────────────────────────────────────────────────

  /**
   * Situação de manutenção de cada veículo ativo (só os das frentes de quem pede): os planos que valem
   * para ele, a pior situação e o resumo para o painel. Os veículos vêm na ordem de urgência.
   */
  async overview(now = new Date()) {
    const [vehicles, plans] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { isActive: true }, select: VEHICLE_SELECT, orderBy: { plate: 'asc' } }),
      this.activePlans(),
    ]);
    const last = await this.lastDone(plans.map((p) => p.id));
    const rows = vehicles.map((vehicle) => {
      const statuses = plans
        .filter((plan) => appliesTo(plan, vehicle))
        .map((plan) => planStatus(plan, vehicle.mileage, last.get(key(vehicle.id, plan.id)) ?? null, now))
        .sort(byUrgency);
      return { ...vehicle, state: worstState(statuses), plans: statuses };
    });
    rows.sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        (a.plans[0]?.remainingKm ?? Infinity) - (b.plans[0]?.remainingKm ?? Infinity) ||
        a.plate.localeCompare(b.plate),
    );
    const summary = Object.fromEntries(STATE_ORDER.map((state) => [state, 0])) as Record<VehicleMaintenanceState, number>;
    for (const row of rows) summary[row.state]++;
    return { plans: plans.length, summary, vehicles: rows };
  }

  /** Contagem para o painel: veículos com manutenção vencida e próxima. */
  async counts() {
    const { plans, summary } = await this.overview();
    return { plans, overdue: summary.VENCIDA, upcoming: summary.PROXIMA };
  }

  /** Ficha do veículo: situação de cada plano, manutenções feitas e o km informado nas inspeções. */
  async vehicle(id: string, now = new Date()) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id }, select: { ...VEHICLE_SELECT, year: true, isActive: true } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const [plans, records, readings] = await Promise.all([
      this.activePlans(),
      this.prisma.maintenanceRecord.findMany({
        where: { vehicleId: id },
        orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
        include: { plan: { select: { id: true, name: true } } },
      }),
      this.prisma.checklist.findMany({
        where: { vehicleId: id, odometerKm: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 60,
        select: { id: true, completedAt: true, odometerKm: true, driver: { select: { name: true } } },
      }),
    ]);
    const applicable = plans.filter((plan) => appliesTo(plan, vehicle));
    const lastByPlan = new Map<string, LastDone>();
    for (const record of records) {
      if (record.planId && !lastByPlan.has(record.planId)) lastByPlan.set(record.planId, { km: record.km, performedAt: record.performedAt });
    }
    const statuses = applicable.map((plan) => planStatus(plan, vehicle.mileage, lastByPlan.get(plan.id) ?? null, now)).sort(byUrgency);
    return {
      vehicle,
      state: worstState(statuses),
      plans: statuses,
      records: records.map((r) => ({ ...r, cost: r.cost === null ? null : Number(r.cost) })),
      readings,
    };
  }

  // ── Manutenções feitas ────────────────────────────────────────────────────

  async createRecord(dto: CreateMaintenanceRecordDto, actor: Actor) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId }, select: { id: true, fleetId: true, mileage: true } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    let title = dto.title?.trim() ?? '';
    if (dto.planId) {
      const plan = await this.prisma.maintenancePlan.findFirst({ where: { id: dto.planId, isActive: true } });
      if (!plan || !appliesTo(plan, vehicle)) throw new BadRequestException('Este plano de manutenção não vale para este veículo.');
      title = plan.name;
    }
    if (!title) throw new BadRequestException('Escolha o plano ou descreva o serviço feito.');
    const performedAt = new Date(dto.performedAt);
    if (performedAt.getTime() > Date.now() + 60 * 60 * 1000) throw new BadRequestException('A data da manutenção não pode ser no futuro.');
    const author = await this.prisma.user.findFirst({ where: { id: actor.id }, select: { name: true } });

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRecord.create({
        data: {
          tenantId: this.tenantId(),
          vehicleId: vehicle.id,
          planId: dto.planId ?? null,
          title,
          performedAt,
          km: dto.km,
          workshop: dto.workshop?.trim() || null,
          cost: dto.cost === undefined ? null : new Prisma.Decimal(dto.cost),
          notes: dto.notes?.trim() || null,
          createdById: actor.id,
          createdByName: author?.name ?? null,
        },
      });
      // O km lido na oficina também vale como km atual (só sobe, como nas inspeções).
      if (dto.km > vehicle.mileage) {
        await tx.vehicle.updateMany({ where: { id: vehicle.id, mileage: { lt: dto.km } }, data: { mileage: dto.km } });
      }
      return created;
    });
    return { ...record, cost: record.cost === null ? null : Number(record.cost) };
  }

  async removeRecord(id: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({ where: { id }, select: { id: true } });
    if (!record) throw new NotFoundException('Registro de manutenção não encontrado.');
    await this.prisma.maintenanceRecord.delete({ where: { id } });
    return { ok: true };
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private tenantId(): string {
    const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
    if (!tenantId) throw new UnauthorizedException('Sessão sem empresa associada.');
    return tenantId;
  }

  private async activePlans(): Promise<ScopedPlan[]> {
    return this.prisma.maintenancePlan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, intervalKm: true, intervalDays: true, warnBeforeKm: true, fleetId: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Última manutenção de cada veículo em cada plano, numa consulta só (DISTINCT ON). */
  private async lastDone(planIds: string[]): Promise<Map<string, LastDone>> {
    const map = new Map<string, LastDone>();
    if (!planIds.length) return map;
    const rows = await this.prisma.$queryRaw<{ vehicleId: string; planId: string; km: number; performedAt: Date }[]>`
      SELECT DISTINCT ON (r."vehicleId", r."planId") r."vehicleId", r."planId", r."km", r."performedAt"
      FROM "MaintenanceRecord" r
      WHERE r."tenantId" = ${this.tenantId()} AND r."planId" IN (${Prisma.join(planIds)})
      ORDER BY r."vehicleId", r."planId", r."performedAt" DESC, r."createdAt" DESC`;
    for (const row of rows) map.set(key(row.vehicleId, row.planId), { km: row.km, performedAt: row.performedAt });
    return map;
  }

  private async findPlan(id: string) {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id, isActive: true } });
    if (!plan) throw new NotFoundException('Plano de manutenção não encontrado.');
    return plan;
  }

  private assertCanEdit(plan: { fleetId: string | null }) {
    if (plan.fleetId === null && currentUnitIds() !== null) {
      throw new ForbiddenException('Este plano vale para todos os veículos da empresa. Só o administrador pode alterá-lo.');
    }
  }

  /** Frota do plano: precisa existir e estar nas frentes de quem pede. Vazio (empresa toda): só quem vê todas. */
  private async resolveFleet(fleetId: string | null): Promise<string | null> {
    if (fleetId === null) {
      if (currentUnitIds() !== null) throw new ForbiddenException('Escolha a frota do plano. Só o administrador cria planos para todos os veículos.');
      return null;
    }
    const fleet = await this.prisma.fleet.findFirst({ where: { id: fleetId }, select: { id: true } });
    if (!fleet) throw new BadRequestException('Frota não encontrada.');
    return fleet.id;
  }

  private assertWarn(warnBeforeKm: number | undefined, intervalKm: number) {
    if (warnBeforeKm !== undefined && warnBeforeKm >= intervalKm) {
      throw new BadRequestException('O aviso antecipado precisa ser menor que o intervalo do plano.');
    }
  }
}
