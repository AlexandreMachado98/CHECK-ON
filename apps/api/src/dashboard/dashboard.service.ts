import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_NC_STATUSES } from '../checklist/checklist-rules';
import { startOfDayInTimeZone } from './time-zone';

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

    const [row] = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive")::int AS "activeVehicles",
        (SELECT COUNT(*) FROM "Fleet"    WHERE "tenantId" = ${tenantId} AND "isActive")::int AS "activeFleets",
        (SELECT COUNT(*) FROM "Employee" WHERE "tenantId" = ${tenantId} AND "isActive")::int AS "activeEmployees",
        (SELECT COUNT(*) FROM "User"     WHERE "tenantId" = ${tenantId} AND "isActive")::int AS "activeUsers",
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive" AND "status" = 'LIBERADO')::int  AS "liberados",
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive" AND "status" = 'ATENCAO')::int   AS "atencao",
        (SELECT COUNT(*) FROM "Vehicle"  WHERE "tenantId" = ${tenantId} AND "isActive" AND "status" = 'BLOQUEADO')::int AS "bloqueados",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${activeStatuses}))::int AS "ncsActive",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${activeStatuses}) AND "severity" = 'CRITICAL')::int AS "ncsCritical",
        (SELECT COUNT(*) FROM "NonConformity" WHERE "tenantId" = ${tenantId} AND "status" IN (${activeStatuses}) AND "occurrences" > 1)::int AS "ncsRecurrent",
        (SELECT COUNT(*) FROM "Checklist" WHERE "tenantId" = ${tenantId} AND "completedAt" >= ${startOfToday})::int AS "inspectionsToday",
        (SELECT COUNT(*) FROM "Checklist" WHERE "tenantId" = ${tenantId} AND "completedAt" >= ${sevenDaysAgo})::int AS "inspectionsWeek"
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
}
