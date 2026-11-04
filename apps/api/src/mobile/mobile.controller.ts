import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MobileService } from './mobile.service';

/** Mesmos perfis que podem enviar checklists (POST /checklists/submit). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR', 'SUPERVISOR', 'MOTORISTA')
@Controller('mobile')
export class MobileController {
  constructor(private readonly service: MobileService) {}

  @Get('bootstrap')
  bootstrap() {
    return this.service.bootstrap();
  }

  @Get('vehicles/by-qr/:qrCode')
  findVehicleByQrCode(@Param('qrCode') qrCode: string) {
    return this.service.findVehicleByQrCode(qrCode);
  }

  @Get('vehicles/:id/ncs')
  findVehicleOpenNcs(@Param('id') id: string) {
    return this.service.findVehicleOpenNcs(id);
  }
}
