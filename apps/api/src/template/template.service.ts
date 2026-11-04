// ─── Template (Checklist Builder) ─────────────────────────────────────────────

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateItemDto, UpdateTemplateItemDto } from './dto/template-item.dto';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Templates ───────────────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { categories: true } },
      },
    });
  }

  async findOne(id: string) {
    const tpl = await this.prisma.template.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { order: 'asc' },
          include: {
            items: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!tpl) throw new NotFoundException('Template não encontrado');
    return tpl;
  }

  async create(data: { name: string; description?: string }) {
    return this.prisma.template.create({ data: { ...data, isActive: false } as any });
  }

  async update(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
    const template = await this.findOne(id);
    if (data.isActive === true) {
      const hasIncompleteCategory = template.categories.length === 0 || template.categories.some((category) => category.items.length === 0);
      if (hasIncompleteCategory) {
        throw new BadRequestException('Adicione pelo menos uma seção e uma regra em cada seção antes de ativar o modelo.');
      }
    }
    return this.prisma.template.update({ where: { id }, data: data as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.template.delete({ where: { id } });
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async addCategory(templateId: string, data: { name: string; order?: number }) {
    await this.findOne(templateId);
    const count = await this.prisma.templateCategory.count({ where: { templateId } });
    return this.prisma.templateCategory.create({
      data: { templateId, name: data.name, order: data.order ?? count } as any,
    });
  }

  async updateCategory(categoryId: string, data: { name?: string; order?: number }) {
    const cat = await this.prisma.templateCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.templateCategory.update({ where: { id: categoryId }, data: data as any });
  }

  async removeCategory(categoryId: string) {
    const cat = await this.prisma.templateCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.templateCategory.delete({ where: { id: categoryId } });
  }

  // ── Items ───────────────────────────────────────────────────────────────────

  async addItem(categoryId: string, data: CreateTemplateItemDto) {
    const cat = await this.prisma.templateCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    const count = await this.prisma.templateItem.count({ where: { categoryId } });
    return this.prisma.templateItem.create({
      data: {
        tenantId: cat.tenantId,
        categoryId,
        text: data.text.trim(),
        type: data.type ?? 'PASS_FAIL',
        isRequired: data.isRequired ?? true,
        isCritical: data.isCritical ?? false,
        // Item do tipo foto já é a própria evidência; a opção não se aplica.
        photoRequirement: data.type === 'PHOTO' ? 'NONE' : data.photoRequirement ?? 'NONE',
        order: data.order ?? count,
      },
    });
  }

  async updateItem(itemId: string, data: UpdateTemplateItemDto) {
    const item = await this.prisma.templateItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    // Só os campos editáveis passam: tenantId e categoryId nunca vêm do corpo da requisição.
    const { text, type, isRequired, isCritical, order } = data;
    const finalType = type ?? item.type;
    const photoRequirement = finalType === 'PHOTO' ? 'NONE' : data.photoRequirement;
    return this.prisma.templateItem.update({
      where: { id: itemId },
      data: { text: text?.trim(), type, isRequired, isCritical, photoRequirement, order },
    });
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.templateItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.templateItem.delete({ where: { id: itemId } });
  }
}
