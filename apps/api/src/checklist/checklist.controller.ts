import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Res, Query, HttpCode, HttpStatus, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_IMAGE_BYTES } from '../storage/storage.service';
import type { Request, Response } from 'express';
import { ChecklistService } from './checklist.service';
import { ChecklistExecutionService, AuthenticatedUser } from './checklist-execution.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { SubmitChecklistDto, SyncChecklistsDto } from './dto/submit-checklist.dto';
import { ChecklistPageQueryDto } from '../common/pagination';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PANEL_ROLES } from '../role/role-definitions';

/** Perfis que executam checklists em campo (app) ou registram pelo painel. */
const EXECUTION_ROLES = ['ADMIN_EMPRESA', 'GESTOR', 'SUPERVISOR', 'MOTORISTA'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('checklists')
export class ChecklistController {
  constructor(
    private readonly service: ChecklistService,
    private readonly execution: ChecklistExecutionService,
  ) {}

  /**
   * Envia uma execução completa (cabeçalho + respostas).
   * 201 quando criada; 200 quando o clientId já tinha sido processado.
   */
  @Post('submit')
  @Roles(...EXECUTION_ROLES)
  async submit(
    @Body() dto: SubmitChecklistDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.execution.submit(dto, req.user as AuthenticatedUser);
    if (result.status === 'DUPLICATE') res.status(HttpStatus.OK);
    return result;
  }

  /**
   * Envia uma foto de evidência (campo multipart "file", JPEG, PNG ou WebP, até 4 MB).
   * Devolve { photoUrl }, que vai no campo photoUrl da resposta do item.
   */
  @Post('photos')
  @Roles(...EXECUTION_ROLES)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadPhoto(@UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new BadRequestException('Selecione uma foto JPEG, PNG ou WebP de até 4 MB.');
    return this.execution.uploadPhoto(file);
  }

  /** Recebe um lote de execuções feitas offline. Cada item retorna seu próprio status. */
  @Post('sync')
  @Roles(...EXECUTION_ROLES)
  @HttpCode(HttpStatus.OK)
  async sync(@Body() dto: SyncChecklistsDto, @Req() req: Request) {
    return { results: await this.execution.sync(dto.checklists, req.user as AuthenticatedUser) };
  }

  @Post()
  create(@Body() createDto: CreateChecklistDto) { return this.service.create(createDto); }

  /** Com ?page=, devolve { items, total, page, pageSize } (tela de Inspeções). Sem, a lista completa de antes. */
  @Get()
  findAll(@Query() query: ChecklistPageQueryDto) {
    return query.page ? this.service.findPage(query) : this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateChecklistDto) { return this.service.update(id, updateDto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
