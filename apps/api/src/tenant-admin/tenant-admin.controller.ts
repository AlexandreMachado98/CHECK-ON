import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
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
}
