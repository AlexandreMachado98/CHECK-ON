import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ADMIN_EMPRESA, PANEL_ROLES, SUPER_ADMIN } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @Roles(...PANEL_ROLES)
  get() {
    return this.companyService.get();
  }

  /** Gestor só consulta; quem altera dados e preferências é o administrador. */
  @Patch()
  @Roles(ADMIN_EMPRESA, SUPER_ADMIN)
  update(@Body() dto: UpdateCompanyDto) {
    return this.companyService.update(dto);
  }

  @Post('revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @Roles(ADMIN_EMPRESA, SUPER_ADMIN)
  revokeSessions() {
    return this.companyService.revokeAllSessions();
  }
}
