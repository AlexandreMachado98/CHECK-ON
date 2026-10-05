import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TemplateService } from './template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR', 'SUPER_ADMIN')
@Controller('templates')
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string; description?: string }) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  @Post(':templateId/categories')
  addCategory(
    @Param('templateId') templateId: string,
    @Body() body: { name: string; order?: number },
  ) {
    return this.service.addCategory(templateId, body);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: { name?: string; order?: number },
  ) {
    return this.service.updateCategory(categoryId, body);
  }

  @Delete('categories/:categoryId')
  removeCategory(@Param('categoryId') categoryId: string) {
    return this.service.removeCategory(categoryId);
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  @Post('categories/:categoryId/items')
  addItem(
    @Param('categoryId') categoryId: string,
    @Body() body: { text: string; type?: string; isRequired?: boolean; order?: number },
  ) {
    return this.service.addItem(categoryId, body);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() body: { text?: string; type?: string; isRequired?: boolean; order?: number },
  ) {
    return this.service.updateItem(itemId, body);
  }

  @Delete('items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.service.removeItem(itemId);
  }
}
