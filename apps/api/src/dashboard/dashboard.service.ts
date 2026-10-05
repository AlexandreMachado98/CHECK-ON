import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const [vehiclesCount, fleetsCount, employeesCount, usersCount] = await Promise.all([
      this.prisma.vehicle.count({ where: { isActive: true } }),
      this.prisma.fleet.count({ where: { isActive: true } }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    return {
      activeVehicles: vehiclesCount,
      activeFleets: fleetsCount,
      activeEmployees: employeesCount,
      activeUsers: usersCount,
    };
  }
}
