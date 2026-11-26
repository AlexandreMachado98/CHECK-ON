import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';
import { CreateMaintenancePlanDto, UpdateMaintenancePlanDto, RecordMaintenanceDto } from './maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @Roles(...OPERATION_ROLES)
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateMaintenancePlanDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenancePlanDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Delete(':id/permanent')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/services')
  @Roles(...OPERATION_ROLES)
  history(@Param('id') id: string) {
    return this.service.history(id);
  }

  @Post(':id/services')
  record(@Param('id') id: string, @Body() dto: RecordMaintenanceDto) {
    return this.service.record(id, dto);
  }
}
