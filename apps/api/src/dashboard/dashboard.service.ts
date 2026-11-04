import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_NC_STATUSES } from '../checklist/checklist-rules';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      vehiclesCount, fleetsCount, employeesCount, usersCount,
      liberados, atencao, bloqueados,
      ncsActive, ncsCritical, ncsRecurrent,
      inspectionsToday, inspectionsWeek,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { isActive: true } }),
      this.prisma.fleet.count({ where: { isActive: true } }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.vehicle.count({ where: { isActive: true, status: 'LIBERADO' } }),
      this.prisma.vehicle.count({ where: { isActive: true, status: 'ATENCAO' } }),
      this.prisma.vehicle.count({ where: { isActive: true, status: 'BLOQUEADO' } }),
      this.prisma.nonConformity.count({ where: { status: { in: ACTIVE_NC_STATUSES } } }),
      this.prisma.nonConformity.count({ where: { status: { in: ACTIVE_NC_STATUSES }, severity: 'CRITICAL' } }),
      this.prisma.nonConformity.count({ where: { status: { in: ACTIVE_NC_STATUSES }, occurrences: { gt: 1 } } }),
      this.prisma.checklist.count({ where: { completedAt: { gte: startOfToday } } }),
      this.prisma.checklist.count({ where: { completedAt: { gte: sevenDaysAgo } } }),
    ]);

    return {
      activeVehicles: vehiclesCount,
      activeFleets: fleetsCount,
      activeEmployees: employeesCount,
      activeUsers: usersCount,
      vehicleStatus: { LIBERADO: liberados, ATENCAO: atencao, BLOQUEADO: bloqueados },
      ncs: { active: ncsActive, critical: ncsCritical, recurrent: ncsRecurrent },
      inspections: { today: inspectionsToday, last7Days: inspectionsWeek },
    };
  }
}
