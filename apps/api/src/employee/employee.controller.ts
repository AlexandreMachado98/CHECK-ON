import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_IMAGE_BYTES } from '../storage/storage.service';
import { EmployeeService } from './employee.service';
import type { PhotoUploadFile } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PANEL_ROLES } from '../role/role-definitions';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PANEL_ROLES)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Post()
  create(@Body() createDto: CreateEmployeeDto) { return this.service.create(createDto); }

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateEmployeeDto) { return this.service.update(id, updateDto); }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file?: PhotoUploadFile) {
    if (!file) throw new BadRequestException('Selecione uma foto JPEG, PNG ou WebP de até 4 MB.');
    return this.service.uploadPhoto(id, file);
  }

  @Post(':id/badge/rotate-token')
  rotateBadgeToken(@Param('id') id: string) {
    return this.service.rotateBadgeToken(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
