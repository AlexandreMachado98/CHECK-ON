import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES } from '../role/role-definitions';

/** Indicadores da empresa: só perfis do painel (motorista não vê os números da operação). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...OPERATION_ROLES)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('report')
  getReport() {
    return this.dashboardService.getReport();
  }
}
