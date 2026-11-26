import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ImportFleetsDto } from './dto/import-fleets.dto';
import { FleetService } from './fleet.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ADMIN_EMPRESA, OPERATION_ROLES, PANEL_ROLES, SUPER_ADMIN } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('fleets')
export class FleetController {
  constructor(private readonly service: FleetService) {}

  @Post()
  create(@Body() createDto: CreateFleetDto) { return this.service.create(createDto); }

  /** Importação por planilha: dryRun só confere; frente nova só é criada pelo administrador. */
  @Post('import')
  import(@Body() dto: ImportFleetsDto, @Req() req: Request) {
    const role = (req.user as { role?: string }).role;
    return this.service.importFleets(dto, role === ADMIN_EMPRESA || role === SUPER_ADMIN);
  }

  @Get()
  @Roles(...OPERATION_ROLES)
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Roles(...OPERATION_ROLES)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateFleetDto) { return this.service.update(id, updateDto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
