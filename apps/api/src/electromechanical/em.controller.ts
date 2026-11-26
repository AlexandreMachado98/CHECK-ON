import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';
import { MAX_IMAGE_BYTES } from '../storage/storage.service';
import { ElectromechanicalService } from './em.service';
import { CreateEmInspectionDto, ReleaseEmDto } from './em.dto';

const actor = (req: Request) => ({ id: (req.user as { id: string }).id });

/** Inspeção eletromecânica: gestores registram laudos e liberam provisoriamente; o supervisor consulta. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('electromechanical')
export class ElectromechanicalController {
  constructor(private readonly service: ElectromechanicalService) {}

  @Get('summary')
  @Roles(...OPERATION_ROLES)
  summary() { return this.service.summary(); }

  @Get('vehicles/:id')
  @Roles(...OPERATION_ROLES)
  vehicle(@Param('id', ParseUUIDPipe) id: string) { return this.service.vehicle(id); }

  /** Foto do laudo (multipart "file", JPEG/PNG/WebP até 4 MB). Devolve { photoUrl }. */
  @Post('photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadPhoto(@UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new BadRequestException('Selecione uma foto JPEG, PNG ou WebP de até 4 MB.');
    return this.service.uploadPhoto(file);
  }

  @Post('inspections')
  create(@Body() dto: CreateEmInspectionDto, @Req() req: Request) { return this.service.create(dto, actor(req)); }

  @Delete('inspections/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }

  @Post('vehicles/:id/release')
  release(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseEmDto, @Req() req: Request) { return this.service.release(id, dto, actor(req)); }

  @Delete('vehicles/:id/release')
  endRelease(@Param('id', ParseUUIDPipe) id: string) { return this.service.endRelease(id); }
}
