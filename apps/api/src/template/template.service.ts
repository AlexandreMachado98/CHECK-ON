// ─── Template (Checklist Builder) ─────────────────────────────────────────────
//
// Histórico: cada mudança em seções ou itens sobe a versão do modelo. Seções e itens que já têm
// respostas não são apagados, só desativados, para que checklists antigos continuem completos.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateItemDto, UpdateTemplateItemDto } from './dto/template-item.dto';

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Templates ───────────────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { categories: { where: { isActive: true } } } },
      },
    });
  }

  async findOne(id: string) {
    const tpl = await this.prisma.template.findUnique({
      where: { id },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            items: { where: { isActive: true }, orderBy: { order: 'asc' } },
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
    const executions = await this.prisma.checklist.count({ where: { templateId: id } });
    if (executions > 0) {
      throw new ConflictException(
        'Este modelo já tem checklists registrados e não pode ser excluído. Desative-o para que não apareça mais no app.',
      );
    }
    return this.prisma.template.delete({ where: { id } });
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async addCategory(templateId: string, data: { name: string; order?: number }) {
    await this.findOne(templateId);
    const count = await this.prisma.templateCategory.count({ where: { templateId, isActive: true } });
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.templateCategory.create({
        data: { templateId, name: data.name, order: data.order ?? count } as any,
      });
      await this.bumpVersion(tx, templateId);
      return category;
    });
  }

  async updateCategory(categoryId: string, data: { name?: string; order?: number }) {
    const cat = await this.findActiveCategory(categoryId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.templateCategory.update({
        where: { id: categoryId },
        data: { name: data.name, order: data.order },
      });
      await this.bumpVersion(tx, cat.templateId);
      return updated;
    });
  }

  async removeCategory(categoryId: string) {
    const cat = await this.findActiveCategory(categoryId);
    const answers = await this.prisma.checklistAnswer.count({ where: { item: { categoryId } } });

    return this.prisma.$transaction(async (tx) => {
      let result;
      if (answers > 0) {
        await tx.templateItem.updateMany({ where: { categoryId }, data: { isActive: false } });
        result = await tx.templateCategory.update({ where: { id: categoryId }, data: { isActive: false } });
      } else {
        result = await tx.templateCategory.delete({ where: { id: categoryId } });
      }
      await this.bumpVersion(tx, cat.templateId);
      return result;
    });
  }

  // ── Items ───────────────────────────────────────────────────────────────────

  async addItem(categoryId: string, data: CreateTemplateItemDto) {
    const cat = await this.findActiveCategory(categoryId);
    const count = await this.prisma.templateItem.count({ where: { categoryId, isActive: true } });
    return this.prisma.$transaction(async (tx) => {
      const version = await this.bumpVersion(tx, cat.templateId);
      return tx.templateItem.create({
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
          addedInVersion: version,
        },
      });
    });
  }

  async updateItem(itemId: string, data: UpdateTemplateItemDto) {
    const item = await this.findActiveItem(itemId);
    // Só os campos editáveis passam: tenantId e categoryId nunca vêm do corpo da requisição.
    const { text, type, isRequired, isCritical, order } = data;
    const finalType = type ?? item.type;
    const photoRequirement = finalType === 'PHOTO' ? 'NONE' : data.photoRequirement;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.templateItem.update({
        where: { id: itemId },
        data: { text: text?.trim(), type, isRequired, isCritical, photoRequirement, order },
      });
      await this.bumpVersion(tx, item.category.templateId);
      return updated;
    });
  }

  async removeItem(itemId: string) {
    const item = await this.findActiveItem(itemId);
    const answers = await this.prisma.checklistAnswer.count({ where: { itemId } });
    return this.prisma.$transaction(async (tx) => {
      const result =
        answers > 0
          ? await tx.templateItem.update({ where: { id: itemId }, data: { isActive: false } })
          : await tx.templateItem.delete({ where: { id: itemId } });
      await this.bumpVersion(tx, item.category.templateId);
      return result;
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Sobe a versão do modelo e devolve o novo número. */
  private async bumpVersion(tx: Tx, templateId: string): Promise<number> {
    const template = await tx.template.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
      select: { version: true },
    });
    return template.version;
  }

  private async findActiveCategory(categoryId: string) {
    const cat = await this.prisma.templateCategory.findFirst({ where: { id: categoryId, isActive: true } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return cat;
  }

  private async findActiveItem(itemId: string) {
    const item = await this.prisma.templateItem.findFirst({
      where: { id: itemId, isActive: true },
      include: { category: { select: { templateId: true } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    return item;
  }
}
