import { ForbiddenException, Injectable } from '@nestjs/common';
import { sqlEmployeeInScope, sqlFleetInScope, sqlUnitInScope, sqlUserInScope, sqlVehicleInScope } from '../common/unit-scope';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_NC_STATUSES } from '../checklist/checklist-rules';
import { startOfDayInTimeZone } from './time-zone';
import { PANEL_ROLES } from '../role/role-definitions';

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
   * Números da tela de Relatórios, calculados no banco (antes a tela baixava todas as inspeções e NCs).
   * Conformidade = inspeções finalizadas sem nenhum item não conforme / inspeções finalizadas.
   */
  async getReport() {
    const tenantId = this.cls.get<string | undefined>('tenantId');
    if (!tenantId) throw new ForbiddenException('Empresa não identificada na sessão.');

    // Frentes de trabalho: filtro à mão (SQL direto não passa pela extensão do Prisma).
    const checklistScope = sqlVehicleInScope('"vehicleId"');
    const checklistScopeC = sqlVehicleInScope('c."vehicleId"');
    const ncScope = sqlVehicleInScope('"vehicleId"');

    const [totals] = await this.prisma.$queryRaw<
      { total: number; completed: number; completedWithNc: number; totalNcs: number; activeNcs: number }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM "Checklist" WHERE "tenantId" = ${tenantId}${checklistScope})::int AS "total",
        (SELECT COUNT(*) FROM "Checklist" WHERE "tenantId" = ${tenantId} AND "status" IN ('COMPLETED', 'SYNCED')${checklistScope})::int AS "completed",
        (SELECT COUNT(*) FROM "Checklist" c WHERE c."tenantId" = ${tenantId} AND c."status" IN ('COMPLETED', 'SYNCED')${checklistScopeC}
           AND EXISTS (SELECT 1 FROM "ChecklistAnswer" a WHERE a."checklistId" = c.id AND NOT a."isCompliant"))::int AS "completedWithNc",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId}${ncScope})::int AS "totalNcs",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${Prisma.join(ACTIVE_NC_STATUSES)})${ncScope})::int AS "activeNcs"
    `;
    const [bySeverity, topVehicles] = await Promise.all([
      this.prisma.$queryRaw<{ severity: string; count: number }[]>`
        SELECT "severity", COUNT(*)::int AS "count" FROM "NonConformity" WHERE "tenantId" = ${tenantId}${ncScope} GROUP BY "severity"`,
      this.prisma.$queryRaw<{ vehicleId: string; plate: string; count: number }[]>`
        SELECT c."vehicleId", v."plate", COUNT(*)::int AS "count"
        FROM "Checklist" c JOIN "Vehicle" v ON v.id = c."vehicleId"
        WHERE c."tenantId" = ${tenantId}${checklistScopeC}
        GROUP BY c."vehicleId", v."plate" ORDER BY "count" DESC, v."plate" LIMIT 5`,
    ]);

    const compliant = totals.completed - totals.completedWithNc;
    return {
      inspections: { total: totals.total, completed: totals.completed, withNc: totals.completedWithNc, compliant },
      complianceRate: totals.completed > 0 ? Math.round((compliant / totals.completed) * 100) : null,
      ncs: {
        total: totals.totalNcs,
        active: totals.activeNcs,
        bySeverity: Object.fromEntries(bySeverity.map((row) => [row.severity, row.count])) as Record<string, number>,
      },
      topVehicles,
    };
  }
}
