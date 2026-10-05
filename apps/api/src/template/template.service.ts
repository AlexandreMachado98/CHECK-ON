// ─── Template (Checklist Builder) ─────────────────────────────────────────────

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    return this.prisma.template.create({ data: data as any });
  }

  async update(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
    await this.findOne(id);
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

  async addItem(
    categoryId: string,
    data: { text: string; type?: string; isRequired?: boolean; order?: number },
  ) {
    const cat = await this.prisma.templateCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    const count = await this.prisma.templateItem.count({ where: { categoryId } });
    return this.prisma.templateItem.create({
      data: {
        categoryId,
        templateId: cat.templateId,
        text: data.text,
        type: data.type ?? 'PASS_FAIL',
        isRequired: data.isRequired ?? true,
        order: data.order ?? count,
      } as any,
    });
  }

  async updateItem(
    itemId: string,
    data: { text?: string; type?: string; isRequired?: boolean; order?: number },
  ) {
    const item = await this.prisma.templateItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.templateItem.update({ where: { id: itemId }, data: data as any });
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.templateItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.templateItem.delete({ where: { id: itemId } });
  }
}
