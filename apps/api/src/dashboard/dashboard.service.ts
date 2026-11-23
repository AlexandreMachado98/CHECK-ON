import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { sqlEmployeeInScope, sqlFleetInScope, sqlUnitInScope, sqlUserInScope, sqlVehicleInScope } from '../common/unit-scope';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_NC_STATUSES } from '../checklist/checklist-rules';
import { startOfDayInTimeZone } from './time-zone';
import { PANEL_ROLES } from '../role/role-definitions';
import { ReportQueryDto, resolveReportRange } from './report-period';

type SummaryRow = {
  activeVehicles: number;
  activeFleets: number;
  activeEmployees: number;
  activeUsers: number;
  liberados: number;
  atencao: number;
  bloqueados: number;
  ncsActive: number;
  ncsCritical: number;
  ncsRecurrent: number;
  inspectionsToday: number;
  inspectionsWeek: number;
};

/** Fuso usado para "hoje" e "últimos 7 dias" (o servidor da Vercel roda em UTC). */
function dashboardTimeZone(): string {
  return process.env.DASHBOARD_TIMEZONE?.trim() || 'America/Sao_Paulo';
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Todos os números do painel em UMA ida ao banco.
   * Antes eram 12 consultas; com o banco a ~100 ms de distância, cada uma custava uma viagem.
   * SQL direto não passa pelo filtro automático de tenant, por isso o tenantId entra explicitamente
   * em cada subconsulta, e a consulta falha fechada se não houver tenant no contexto.
   */
  async getSummary() {
    const tenantId = this.cls.get<string | undefined>('tenantId');
    if (!tenantId) throw new ForbiddenException('Empresa não identificada na sessão.');

    const startOfToday = startOfDayInTimeZone(new Date(), dashboardTimeZone());
    const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const activeStatuses = Prisma.join(ACTIVE_NC_STATUSES);
    // Só quem usa o painel; motoristas e supervisores usam o app.
    const panelRoles = Prisma.join(PANEL_ROLES);

    // Frentes de trabalho: SQL direto não passa pela extensão do Prisma; o filtro vai à mão.
    const vehicleScope = sqlFleetInScope('"fleetId"');
    const fleetScope = sqlUnitInScope('"unitId"');
    const employeeScope = sqlEmployeeInScope('"id"');
    const userScope = sqlUserInScope('u."id"');
    const ncScope = sqlVehicleInScope('"vehicleId"');
    const checklistScope = sqlVehicleInScope('"vehicleId"');

    const [row] = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive"${vehicleScope})::int AS "activeVehicles",
        (SELECT COUNT(*) FROM "Fleet"    WHERE "tenantId" = ${tenantId} AND "isActive"${fleetScope})::int AS "activeFleets",
        (SELECT COUNT(*) FROM "Employee" WHERE "tenantId" = ${tenantId} AND "isActive"${employeeScope})::int AS "activeEmployees",
        (SELECT COUNT(*) FROM "User" u JOIN "Role" r ON r.id = u."roleId"
           WHERE u."tenantId" = ${tenantId} AND u."isActive" AND r.name IN (${panelRoles})${userScope})::int AS "activeUsers",
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive" AND "status" = 'LIBERADO'${vehicleScope})::int  AS "liberados",
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive" AND "status" = 'ATENCAO'${vehicleScope})::int   AS "atencao",
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive" AND "status" = 'BLOQUEADO'${vehicleScope})::int AS "bloqueados",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${activeStatuses})${ncScope})::int AS "ncsActive",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${activeStatuses}) AND "severity" = 'CRITICAL'${ncScope})::int AS "ncsCritical",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${activeStatuses}) AND "occurrences" > 1${ncScope})::int AS "ncsRecurrent",
        (SELECT COUNT(*) FROM "Checklist" WHERE "tenantId" = ${tenantId} AND "completedAt" >= ${startOfToday}${checklistScope})::int AS "inspectionsToday",
        (SELECT COUNT(*) FROM "Checklist" WHERE "tenantId" = ${tenantId} AND "completedAt" >= ${sevenDaysAgo}${checklistScope})::int AS "inspectionsWeek"
    `;

    return {
      activeVehicles: row.activeVehicles,
      activeFleets: row.activeFleets,
      activeEmployees: row.activeEmployees,
      activeUsers: row.activeUsers,
      vehicleStatus: { LIBERADO: row.liberados, ATENCAO: row.atencao, BLOQUEADO: row.bloqueados },
      ncs: { active: row.ncsActive, critical: row.ncsCritical, recurrent: row.ncsRecurrent },
      inspections: { today: row.inspectionsToday, last7Days: row.inspectionsWeek },
    };
  }

  /**
   * Números da tela de Relatórios, calculados no banco, para o período escolhido (padrão: 30 dias) e,
   * opcionalmente, uma frente de trabalho. Traz também o período anterior de mesmo tamanho, para comparar.
   * Inspeções contam pela data de conclusão (ou de início, se ainda não concluída); NCs pela abertura.
   * Conformidade = inspeções finalizadas sem nenhum item não conforme / inspeções finalizadas.
   */
  async getReport(query: ReportQueryDto = {}) {
    const tenantId = this.requireTenant();
    const range = resolveReportRange(query, new Date(), dashboardTimeZone());
    const unit = await this.reportUnit(query.unitId);
    const vehicleFilter = (column: string) => Prisma.sql`${sqlVehicleInScope(column)}${unit ? sqlVehicleInUnit(column, unit.id) : Prisma.empty}`;

    const [current, previous, bySeverity, topVehicles] = await Promise.all([
      this.reportTotals(tenantId, range.from, range.to, vehicleFilter),
      range.previous ? this.reportTotals(tenantId, range.previous.from, range.previous.to, vehicleFilter) : null,
      this.prisma.$queryRaw<{ severity: string; count: number }[]>`
        SELECT "severity", COUNT(*)::int AS "count" FROM "NonConformity"
        WHERE "tenantId" = ${tenantId}${ncInRange('"createdAt"', range.from, range.to)}${vehicleFilter('"vehicleId"')}
        GROUP BY "severity"`,
      this.prisma.$queryRaw<{ vehicleId: string; plate: string; count: number }[]>`
        SELECT c."vehicleId", v."plate", COUNT(*)::int AS "count"
        FROM "Checklist" c JOIN "Vehicle" v ON v.id = c."vehicleId"
        WHERE c."tenantId" = ${tenantId}${checklistInRange('c.', range.from, range.to)}${vehicleFilter('c."vehicleId"')}
        GROUP BY c."vehicleId", v."plate" ORDER BY "count" DESC, v."plate" LIMIT 5`,
    ]);

    return {
      period: {
        key: range.key,
        from: range.from?.toISOString() ?? null,
        to: range.to?.toISOString() ?? null,
      },
      unit: unit ? { id: unit.id, name: unit.name, client: unit.client } : null,
      inspections: current.inspections,
      complianceRate: current.complianceRate,
      ncs: {
        total: current.ncs.total,
        active: current.ncs.active,
        bySeverity: Object.fromEntries(bySeverity.map((row) => [row.severity, row.count])) as Record<string, number>,
      },
      topVehicles,
      previous: previous && range.previous
        ? { from: range.previous.from.toISOString(), to: range.previous.to.toISOString(), ...previous }
        : null,
    };
  }

  /**
   * Uma linha por veículo (para exportar o relatório): inspeções no período, quantas com problema,
   * conformidade, NCs abertas no período, NCs ativas hoje e a última inspeção. Inclui veículos sem
   * nenhuma inspeção no período (aparecem com 0), em ordem de placa.
   */
  async getReportByVehicle(query: ReportQueryDto = {}) {
    const tenantId = this.requireTenant();
    const range = resolveReportRange(query, new Date(), dashboardTimeZone());
    const unit = await this.reportUnit(query.unitId);
    const unitFilter = unit ? Prisma.sql` AND f."unitId" = ${unit.id}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      {
        plate: string; prefix: string | null; model: string | null; fleet: string; unit: string | null; status: string;
        inspections: number; completed: number; withNc: number; ncsOpened: number; activeNcs: number; lastInspection: Date | null;
      }[]
    >`
      SELECT v."plate", v."prefix", v."model", f."name" AS "fleet", u."name" AS "unit", v."status",
        COALESCE(ck."inspections", 0)::int AS "inspections",
        COALESCE(ck."completed", 0)::int AS "completed",
        COALESCE(ck."withNc", 0)::int AS "withNc",
        (SELECT COUNT(*) FROM "NonConformity" n WHERE n."tenantId" = ${tenantId} AND n."vehicleId" = v.id${ncInRange('n."createdAt"', range.from, range.to)})::int AS "ncsOpened",
        (SELECT COUNT(*) FROM "NonConformity" n WHERE n."tenantId" = ${tenantId} AND n."vehicleId" = v.id AND n."status" IN (${Prisma.join(ACTIVE_NC_STATUSES)}))::int AS "activeNcs",
        (SELECT MAX(c2."completedAt") FROM "Checklist" c2 WHERE c2."tenantId" = ${tenantId} AND c2."vehicleId" = v.id${checklistInRange('c2.', range.from, range.to)}) AS "lastInspection"
      FROM "Vehicle" v
      JOIN "Fleet" f ON f.id = v."fleetId"
      LEFT JOIN "Unit" u ON u.id = f."unitId"
      LEFT JOIN (
        SELECT c."vehicleId",
          COUNT(*) AS "inspections",
          COUNT(*) FILTER (WHERE c."status" IN ('COMPLETED', 'SYNCED')) AS "completed",
          COUNT(*) FILTER (WHERE c."status" IN ('COMPLETED', 'SYNCED')
            AND EXISTS (SELECT 1 FROM "ChecklistAnswer" a WHERE a."checklistId" = c.id AND NOT a."isCompliant")) AS "withNc"
        FROM "Checklist" c
        WHERE c."tenantId" = ${tenantId}${checklistInRange('c.', range.from, range.to)}
        GROUP BY c."vehicleId"
      ) ck ON ck."vehicleId" = v.id
      WHERE v."tenantId" = ${tenantId} AND v."isActive"${sqlVehicleInScope('v.id')}${unitFilter}
      ORDER BY v."plate"`;
    return rows.map((row) => ({
      ...row,
      complianceRate: row.completed > 0 ? Math.round(((row.completed - row.withNc) / row.completed) * 100) : null,
      lastInspection: row.lastInspection ? new Date(row.lastInspection).toISOString() : null,
    }));
  }

  private requireTenant(): string {
    const tenantId = this.cls.get<string | undefined>('tenantId');
    if (!tenantId) throw new ForbiddenException('Empresa não identificada na sessão.');
    return tenantId;
  }

  /** Frente pedida no filtro. Passa pelo filtro automático: frente de fora do escopo da pessoa não existe. */
  private async reportUnit(unitId?: string) {
    if (!unitId) return null;
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId }, select: { id: true, name: true, client: true } });
    if (!unit) throw new NotFoundException('Frente de trabalho não encontrada.');
    return unit;
  }

  /** Totais do relatório num intervalo (inspeções, conformidade e NCs). */
  private async reportTotals(tenantId: string, from: Date | null, to: Date | null, vehicleFilter: (column: string) => Prisma.Sql) {
    const [row] = await this.prisma.$queryRaw<
      { total: number; completed: number; completedWithNc: number; totalNcs: number; activeNcs: number }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM "Checklist" c WHERE c."tenantId" = ${tenantId}${checklistInRange('c.', from, to)}${vehicleFilter('c."vehicleId"')})::int AS "total",
        (SELECT COUNT(*) FROM "Checklist" c WHERE c."tenantId" = ${tenantId} AND c."status" IN ('COMPLETED', 'SYNCED')${checklistInRange('c.', from, to)}${vehicleFilter('c."vehicleId"')})::int AS "completed",
        (SELECT COUNT(*) FROM "Checklist" c WHERE c."tenantId" = ${tenantId} AND c."status" IN ('COMPLETED', 'SYNCED')${checklistInRange('c.', from, to)}${vehicleFilter('c."vehicleId"')}
           AND EXISTS (SELECT 1 FROM "ChecklistAnswer" a WHERE a."checklistId" = c.id AND NOT a."isCompliant"))::int AS "completedWithNc",
        (SELECT COUNT(*) FROM "NonConformity" n WHERE n."tenantId" = ${tenantId}${ncInRange('n."createdAt"', from, to)}${vehicleFilter('n."vehicleId"')})::int AS "totalNcs",
        (SELECT COUNT(*) FROM "NonConformity" n WHERE n."tenantId" = ${tenantId} AND n."status" IN (${Prisma.join(ACTIVE_NC_STATUSES)})${ncInRange('n."createdAt"', from, to)}${vehicleFilter('n."vehicleId"')})::int AS "activeNcs"
    `;
    const compliant = row.completed - row.completedWithNc;
    return {
      inspections: { total: row.total, completed: row.completed, withNc: row.completedWithNc, compliant },
      complianceRate: row.completed > 0 ? Math.round((compliant / row.completed) * 100) : null,
      ncs: { total: row.totalNcs, active: row.activeNcs },
    };
  }
}

/**
 * Inspeção dentro do intervalo: pela conclusão, ou pelo início se ainda não concluída.
 * Usa os índices (tenantId, completedAt) e (tenantId, startedAt). `alias` é SQL confiável ("c.").
 */
function checklistInRange(alias: string, from: Date | null, to: Date | null): Prisma.Sql {
  if (!from && !to) return Prisma.empty;
  const done = Prisma.raw(`${alias}"completedAt"`);
  const started = Prisma.raw(`${alias}"startedAt"`);
  const bounds = (col: Prisma.Sql) =>
    Prisma.sql`${from ? Prisma.sql` AND ${col} >= ${from}` : Prisma.empty}${to ? Prisma.sql` AND ${col} < ${to}` : Prisma.empty}`;
  return Prisma.sql` AND ((${done} IS NOT NULL${bounds(done)}) OR (${done} IS NULL${bounds(started)}))`;
}

/** NC aberta dentro do intervalo. `column` é SQL confiável. */
function ncInRange(column: string, from: Date | null, to: Date | null): Prisma.Sql {
  const col = Prisma.raw(column);
  return Prisma.sql`${from ? Prisma.sql` AND ${col} >= ${from}` : Prisma.empty}${to ? Prisma.sql` AND ${col} < ${to}` : Prisma.empty}`;
}

/** Veículo de uma frente específica. `column` é SQL confiável. */
function sqlVehicleInUnit(column: string, unitId: string): Prisma.Sql {
  return Prisma.sql` AND ${Prisma.raw(column)} IN (
    SELECT v3."id" FROM "Vehicle" v3 JOIN "Fleet" f3 ON f3."id" = v3."fleetId" WHERE f3."unitId" = ${unitId})`;
}
