import { Controller, Get, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { NcService } from './nc.service';
import { UpdateNcDto } from './dto/update-nc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR')
@Controller('ncs')
export class NcController {
  constructor(private readonly ncService: NcService) {}

  @Get()
  findAll() {
    return this.ncService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNcDto: UpdateNcDto) {
    return this.ncService.update(id, updateNcDto);
  }
}
