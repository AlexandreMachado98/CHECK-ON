import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards, DefaultValuePipe } from '@nestjs/common';
import type { Request } from 'express';
import { MasterTokenGuard } from './master-token.guard';
import { MasterService } from './master.service';
import { CreateMasterCompanyDto, RenewMasterCompanyDto, ResetAdminPasswordDto, UpdateMasterCompanyDto } from './dto/master-company.dto';

/** Quem fez a ação no DDS Master (e-mail do administrador mestre), só para o histórico. */
function actor(req: Request): string | undefined {
  const value = req.get('x-master-actor')?.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return value ? value.slice(0, 160) : undefined;
}

/**
 * API do DDS Master para os clientes do CHECK-ON (servidor a servidor).
 * Autenticação: "Authorization: Bearer <CHECKON_MASTER_TOKEN>". Não usa login de usuário.
 */
@UseGuards(MasterTokenGuard)
@Controller('master')
export class MasterController {
  constructor(private readonly service: MasterService) {}

  /** Teste da conexão (o Master mostra "conectado"). */
  @Get('ping')
  ping() {
    return { ok: true, service: 'CHECK-ON', time: new Date().toISOString() };
  }

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('companies')
  list() {
    return this.service.listCompanies();
  }

  @Post('companies')
  create(@Body() dto: CreateMasterCompanyDto, @Req() req: Request) {
    return this.service.createCompany(dto, actor(req));
  }

  @Get('companies/:id')
  get(@Param('id') id: string) {
    return this.service.getCompany(id);
  }

  @Patch('companies/:id')
  update(@Param('id') id: string, @Body() dto: UpdateMasterCompanyDto, @Req() req: Request) {
    return this.service.updateCompany(id, dto, actor(req));
  }

  @Post('companies/:id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewMasterCompanyDto, @Req() req: Request) {
    return this.service.renew(id, dto, actor(req));
  }

  @Post('companies/:id/admin-password')
  resetAdminPassword(@Param('id') id: string, @Body() dto: ResetAdminPasswordDto, @Req() req: Request) {
    return this.service.resetAdminPassword(id, dto, actor(req));
  }

  @Get('history')
  history(@Query('tenantId') tenantId?: string, @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100) {
    return this.service.history(tenantId || undefined, limit);
  }
}
