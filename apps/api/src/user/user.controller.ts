import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserService, type Requester } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAccessDto } from './dto/create-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PANEL_ROLES } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    return this.userService.create(createUserDto, req.user as Requester);
  }

  /** Cria o login de um colaborador (aplicativo ou portal + aplicativo, conforme o perfil). */
  @Post('access')
  createAccess(@Body() dto: CreateAccessDto, @Req() req: Request) {
    return this.userService.createAccess(dto, req.user as Requester);
  }

  /** Gera uma nova senha provisória para o usuário (troca obrigatória no próximo login). */
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id') id: string, @Req() req: Request) {
    return this.userService.resetPassword(id, req.user as Requester);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: Request) {
    return this.userService.update(id, updateUserDto, req.user as Requester);
  }
}
