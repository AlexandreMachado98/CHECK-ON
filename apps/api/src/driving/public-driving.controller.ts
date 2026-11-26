import { Body, Controller, Get, Header, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { DrivingService } from './driving.service';
import { SubmitDrivingFeedbackDto } from './dto/driving.dto';

/** Página pública do QR do passageiro (sem login). */
@Controller('public/vehicles')
export class PublicDrivingController {
  constructor(private readonly service: DrivingService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store, private')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @Header('Referrer-Policy', 'no-referrer')
  find(@Param('token') token: string) {
    return this.service.publicVehicle(token);
  }

  @Post(':token/driving')
  @Header('Cache-Control', 'no-store, private')
  submit(@Param('token') token: string, @Body() dto: SubmitDrivingFeedbackDto, @Req() req: Request) {
    return this.service.submit(token, dto, clientIp(req));
  }
}
