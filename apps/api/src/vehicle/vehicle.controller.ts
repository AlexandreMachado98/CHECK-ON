import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ImportVehiclesDto } from './dto/import-vehicles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly service: VehicleService) {}

  @Post()
  create(@Body() createDto: CreateVehicleDto) { return this.service.create(createDto); }

  /** Importação por planilha: dryRun só confere; sem problemas, grava tudo de uma vez. */
  @Post('import')
  import(@Body() dto: ImportVehiclesDto) { return this.service.importVehicles(dto); }

  @Get()
  @Roles(...OPERATION_ROLES)
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Roles(...OPERATION_ROLES)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  /** Supervisor só libera ou bloqueia (status); os demais campos ficam com gestor e administrador. */
  @Patch(':id')
  @Roles(...OPERATION_ROLES)
  update(@Param('id') id: string, @Body() updateDto: UpdateVehicleDto, @Req() req: Request) {
    const role = (req.user as { role?: string }).role;
    // Só os campos enviados contam (a validação cria as demais propriedades como undefined).
    const sent = Object.entries(updateDto).filter(([, value]) => value !== undefined).map(([key]) => key);
    if (role === 'SUPERVISOR' && sent.some((key) => key !== 'status')) {
      throw new ForbiddenException('Supervisor pode apenas liberar ou bloquear o veículo.');
    }
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
