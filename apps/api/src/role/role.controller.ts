import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PANEL_ROLES } from './role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /** Perfis disponíveis no cadastro de usuários, conforme o perfil de quem pede. */
  @Get()
  findAssignable(@Req() req: Request) {
    return this.roleService.findAssignable((req.user as { role: string }).role);
  }
}
