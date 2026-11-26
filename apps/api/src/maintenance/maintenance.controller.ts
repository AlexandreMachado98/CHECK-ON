import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenancePlanDto, UpdateMaintenancePlanDto } from './dto/maintenance-plan.dto';
import { CreateMaintenanceRecordDto } from './dto/maintenance-record.dto';

/** Controle de manutenção por km: planos, situação dos veículos e manutenções feitas. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @Roles(...OPERATION_ROLES)
  overview() { return this.service.overview(); }

  /** Só as contagens (cartão do painel). */
  @Get('summary')
  @Roles(...OPERATION_ROLES)
  summary() { return this.service.counts(); }

  @Get('vehicles/:id')
  @Roles(...OPERATION_ROLES)
  vehicle(@Param('id', ParseUUIDPipe) id: string) { return this.service.vehicle(id); }

  @Get('plans')
  @Roles(...OPERATION_ROLES)
  listPlans() { return this.service.listPlans(); }

  @Post('plans')
  createPlan(@Body() dto: CreateMaintenancePlanDto) { return this.service.createPlan(dto); }

  @Patch('plans/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMaintenancePlanDto) { return this.service.updatePlan(id, dto); }

  @Delete('plans/:id')
  removePlan(@Param('id', ParseUUIDPipe) id: string) { return this.service.removePlan(id); }

  @Post('records')
  createRecord(@Body() dto: CreateMaintenanceRecordDto, @Req() req: Request) {
    return this.service.createRecord(dto, { id: (req.user as { id: string }).id });
  }

  @Delete('records/:id')
  removeRecord(@Param('id', ParseUUIDPipe) id: string) { return this.service.removeRecord(id); }
}
