// ─── Template (Checklist Builder) ─────────────────────────────────────────────
//
// Histórico: cada mudança em seções ou itens sobe a versão do modelo. Seções e itens que já têm
// respostas não são apagados, só desativados, para que checklists antigos continuem completos.

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateItemDto, UpdateTemplateItemDto } from './dto/template-item.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { currentUnitIds } from '../common/unit-scope';
import { resolveUnitAssignment, visibleUnitsInclude } from '../unit/unit-assignment';

const SHARED_TEMPLATE_MESSAGE =
  'Este modelo também vale para outras frentes de trabalho. Só o administrador da empresa pode alterá-lo.';

/** Quem é limitado a algumas frentes só altera modelos que valem apenas nas frentes dele. */
function canEditTemplate(template: { allUnits: boolean; units: { unitId: string }[] }): boolean {
  const scope = currentUnitIds();
  if (!scope) return true;
  return !template.allUnits && template.units.length > 0 && template.units.every((unit) => scope.includes(unit.unitId));
}

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Templates ───────────────────────────────────────────────────────────────

  async findAll() {
    const templates = await this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { categories: { where: { isActive: true } } } },
        units: visibleUnitsInclude(),
      },
    });
    const editable = await this.editableIds(templates.map((template) => template.id));
    return templates.map((template) => ({ ...template, canEdit: editable.has(template.id) }));
  }

  /** Modelos que quem pede pode alterar (considera todas as frentes do modelo, não só as visíveis). */
  private async editableIds(ids: string[]): Promise<Set<string>> {
    if (!currentUnitIds()) return new Set(ids);
    const rows = await this.prisma.template.findMany({
      where: { id: { in: ids } },
      select: { id: true, allUnits: true, units: { select: { unitId: true } } },
    });
    return new Set(rows.filter(canEditTemplate).map((row) => row.id));
  }

  /** Recusa a alteração de um modelo compartilhado com frentes que quem pede não vê. */
  private async assertEditable(templateId: string) {
    if (!currentUnitIds()) return;
    const template = await this.prisma.template.findFirst({
      where: { id: templateId },
      select: { allUnits: true, units: { select: { unitId: true } } },
    });
    if (!template) throw new NotFoundException('Template não encontrado');
    if (!canEditTemplate(template)) throw new ForbiddenException(SHARED_TEMPLATE_MESSAGE);
  }

  /**
   * Frentes do modelo depois de salvar. Devolve undefined quando não mudam.
   * Quem é limitado a algumas frentes não marca "todas as frentes".
   */
  private async resolveTemplateUnits(
    data: { allUnits?: boolean; unitIds?: string[] },
    current: { allUnits: boolean; unitIds: string[] } | null,
  ): Promise<{ allUnits: boolean; unitIds: string[] } | undefined> {
    const scoped = !!currentUnitIds();
    if (current && data.allUnits === undefined && data.unitIds === undefined) return undefined;

    if (scoped) {
      if (data.allUnits === true) throw new ForbiddenException('Só o administrador da empresa cria modelos para todas as frentes de trabalho.');
      const unitIds = (await resolveUnitAssignment(this.prisma, data.unitIds, current ? current.unitIds : null)) ?? [];
      return { allUnits: false, unitIds };
    }

    const allUnits = data.allUnits ?? (current ? (data.unitIds !== undefined ? false : current.allUnits) : !data.unitIds?.length);
    if (allUnits) return { allUnits: true, unitIds: [] };
    const unitIds = (await resolveUnitAssignment(this.prisma, data.unitIds ?? current?.unitIds ?? [], current ? current.unitIds : null)) ?? [];
    if (unitIds.length === 0) throw new BadRequestException('Escolha as frentes de trabalho do modelo ou marque "todas as frentes".');
    return { allUnits: false, unitIds };
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
        units: visibleUnitsInclude(),
      },
    });
    if (!tpl) throw new NotFoundException('Template não encontrado');
    const editable = await this.editableIds([tpl.id]);
    return { ...tpl, canEdit: editable.has(tpl.id) };
  }

  async create(data: CreateTemplateDto) {
    const units = await this.resolveTemplateUnits(data, null);
    return this.prisma.template.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: false,
        allUnits: units?.allUnits ?? true,
        units: { create: (units?.unitIds ?? []).map((unitId) => ({ unitId })) },
      } as any,
    });
  }

  async update(id: string, data: UpdateTemplateDto) {
    await this.assertEditable(id);
    const template = await this.findOne(id);
    const currentUnits = await this.prisma.template.findFirst({ where: { id }, select: { units: { select: { unitId: true } } } });
    const units = await this.resolveTemplateUnits(data, {
      allUnits: template.allUnits,
      unitIds: currentUnits?.units.map((unit) => unit.unitId) ?? [],
    });
    if (data.isActive === true) {
      const hasIncompleteCategory = template.categories.length === 0 || template.categories.some((category) => category.items.length === 0);
      if (hasIncompleteCategory) {
        throw new BadRequestException('Adicione pelo menos uma seção e uma regra em cada seção antes de ativar o modelo.');
      }
    }
    return this.prisma.template.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        ...(units
          ? { allUnits: units.allUnits, units: { deleteMany: {}, create: units.unitIds.map((unitId) => ({ unitId })) } }
          : {}),
      } as any,
    });
  }

  async remove(id: string) {
    await this.assertEditable(id);
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
    await this.assertEditable(templateId);
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
    await this.assertEditable(cat.templateId);
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
    await this.assertEditable(cat.templateId);
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
    await this.assertEditable(cat.templateId);
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
    await this.assertEditable(item.category.templateId);
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
    await this.assertEditable(item.category.templateId);
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
