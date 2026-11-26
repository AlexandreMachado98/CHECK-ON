import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';
import { clientIp } from '../common/client-ip';
import { SuggestionService } from './suggestion.service';
import { HandleSuggestionDto, RateSuggestionDto, SubmitSuggestionDto } from './suggestion.dto';

/** Sugestões de melhoria no portal: gestores priorizam, arquivam e respondem; o supervisor consulta. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...OPERATION_ROLES)
@Controller('suggestions')
export class SuggestionController {
  constructor(private readonly service: SuggestionService) {}

  @Get()
  list(@Query() query: { days?: string; status?: string }) { return this.service.list(query); }

  @Get('summary')
  summary() { return this.service.summary(); }

  @Patch(':id')
  @Roles(...PANEL_ROLES)
  handle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleSuggestionDto, @Req() req: Request) {
    return this.service.handle(id, dto, { id: (req.user as { id: string }).id });
  }
}

/** Passageiro (sem login): enviar pela página do QR e acompanhar pelo link do protocolo. */
@Controller('public')
export class PublicSuggestionController {
  constructor(private readonly service: SuggestionService) {}

  @Post('vehicles/:token/suggestions')
  @Header('Cache-Control', 'no-store, private')
  submit(@Param('token') token: string, @Body() dto: SubmitSuggestionDto, @Req() req: Request) {
    return this.service.submit(token, dto, clientIp(req));
  }

  @Get('suggestions/:followToken')
  @Header('Cache-Control', 'no-store, private')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @Header('Referrer-Policy', 'no-referrer')
  follow(@Param('followToken') followToken: string) { return this.service.follow(followToken); }

  @Post('suggestions/:followToken/rating')
  @Header('Cache-Control', 'no-store, private')
  rate(@Param('followToken') followToken: string, @Body() dto: RateSuggestionDto) { return this.service.rate(followToken, dto); }
}
