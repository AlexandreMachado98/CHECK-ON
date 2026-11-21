import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ADMIN_EMPRESA, OPERATION_ROLES, SUPER_ADMIN } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
// Cadastrar, editar e excluir frentes: só o administrador. Ver a lista: quem opera o portal (só as frentes dele).
@Roles(ADMIN_EMPRESA, SUPER_ADMIN)
@Controller('units')
export class UnitController {
  constructor(private readonly service: UnitService) {}

  @Post()
  create(@Body() createDto: CreateUnitDto) { return this.service.create(createDto); }

  @Get()
  @Roles(...OPERATION_ROLES)
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Roles(...OPERATION_ROLES)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateUnitDto) { return this.service.update(id, updateDto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
