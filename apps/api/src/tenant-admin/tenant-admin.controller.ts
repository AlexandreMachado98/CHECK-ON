import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TenantAdminService, type PlatformAdmin } from './tenant-admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin/tenants')
export class TenantAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  @Post()
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantAdminService.create(createTenantDto);
  }

  @Get()
  findAll() {
    return this.tenantAdminService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantAdminService.update(id, updateTenantDto);
  }

  /** Entra no painel da empresa como administrador dela (1 hora, registrado). */
  @Post(':id/access')
  access(@Param('id') id: string, @Req() req: Request) {
    return this.tenantAdminService.access(id, req.user as PlatformAdmin, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Get('access-logs')
  accessLogs() {
    return this.tenantAdminService.accessLogs();
  }
}
