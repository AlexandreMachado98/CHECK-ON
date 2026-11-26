import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';
import { DrivingService } from './driving.service';
import { PassengerQrDto, TreatDrivingFeedbackDto } from './dto/driving.dto';

/** "Como estou dirigindo" no portal: só gestores (o supervisor também trata, como nas NCs). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...OPERATION_ROLES)
@Controller('driving-feedback')
export class DrivingController {
  constructor(private readonly service: DrivingService) {}

  @Get()
  list(@Query() query: { days?: string; status?: string; alerts?: string; driverId?: string }) {
    return this.service.list(query);
  }

  @Get('summary')
  summary() { return this.service.summary(); }

  @Patch(':id')
  treat(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TreatDrivingFeedbackDto, @Req() req: Request) {
    return this.service.treat(id, dto, { id: (req.user as { id: string }).id });
  }

  /** Códigos do QR do passageiro para imprimir (cria os que faltam; rotate troca). */
  @Post('passenger-qr')
  @Roles(...PANEL_ROLES)
  passengerQr(@Body() dto: PassengerQrDto) { return this.service.passengerQr(dto); }
}
