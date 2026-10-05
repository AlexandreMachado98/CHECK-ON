import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR')
@Controller('fleets')
export class FleetController {
  constructor(private readonly service: FleetService) {}

  @Post()
  create(@Body() createDto: CreateFleetDto) { return this.service.create(createDto); }

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateFleetDto) { return this.service.update(id, updateDto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
