import { BadRequestException, Controller, Get, Body, Patch, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { MAX_IMAGE_BYTES } from '../storage/storage.service';
import { CreateNcActionDto } from './dto/create-nc-action.dto';
import { NcPageQueryDto } from '../common/pagination';
import { NcService } from './nc.service';
import { UpdateNcDto } from './dto/update-nc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OPERATION_ROLES, PANEL_ROLES } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('ncs')
export class NcController {
  constructor(private readonly ncService: NcService) {}

  /** Lista paginada { items, total, page, pageSize, counts }. Sem ?page= vem a 1ª página. */
  @Get()
  @Roles(...OPERATION_ROLES)
  findAll(@Query() query: NcPageQueryDto) {
    return this.ncService.findPage(query);
  }

  /** Foto da tratativa (multipart "file", JPEG/PNG/WebP até 4 MB). Devolve { photoUrl } para o registro. */
  @Post('photos')
  @Roles(...OPERATION_ROLES)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadPhoto(@UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new BadRequestException('Selecione uma foto JPEG, PNG ou WebP de até 4 MB.');
    return this.ncService.uploadPhoto(file);
  }

  @Get(':id')
  @Roles(...OPERATION_ROLES)
  findOne(@Param('id') id: string) {
    return this.ncService.findOne(id);
  }

  /** Registro da tratativa: texto, fotos (até 3) e/ou nova situação. */
  @Post(':id/actions')
  @Roles(...OPERATION_ROLES)
  addAction(@Param('id') id: string, @Body() dto: CreateNcActionDto, @Req() req: Request) {
    return this.ncService.addAction(id, dto, (req.user as { id: string }).id);
  }

  @Patch(':id')
  @Roles(...OPERATION_ROLES)
  update(@Param('id') id: string, @Body() updateNcDto: UpdateNcDto, @Req() req: Request) {
    return this.ncService.update(id, updateNcDto, (req.user as { id?: string }).id);
  }
}
