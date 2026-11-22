import { ConflictException } from '@nestjs/common';
import { TemplateService } from './template.service';

function buildService() {
  const tx = {
    template: { update: vi.fn().mockResolvedValue({ version: 5 }) },
    templateCategory: {
      create: vi.fn().mockResolvedValue({ id: 'cat-1' }),
      update: vi.fn().mockResolvedValue({ id: 'cat-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    },
    templateItem: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'item-novo', ...data })),
      update: vi.fn().mockResolvedValue({ id: 'item-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      delete: vi.fn().mockResolvedValue({ id: 'item-1' }),
    },
  };
  const prisma = {
    template: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tpl-1', categories: [] }),
      delete: vi.fn().mockResolvedValue({ id: 'tpl-1' }),
    },
    templateCategory: {
      findFirst: vi.fn().mockResolvedValue({ id: 'cat-1', templateId: 'tpl-1', tenantId: 't1' }),
      count: vi.fn().mockResolvedValue(0),
    },
    templateItem: {
      findFirst: vi.fn().mockResolvedValue({ id: 'item-1', type: 'PASS_FAIL', category: { templateId: 'tpl-1' } }),
      count: vi.fn().mockResolvedValue(2),
    },
    checklistAnswer: { count: vi.fn().mockResolvedValue(0) },
    checklist: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, service: new TemplateService(prisma as any) };
}

const bumped = { where: { id: 'tpl-1' }, data: { version: { increment: 1 } }, select: { version: true } };

describe('TemplateService — histórico', () => {
  it('item novo registra a versão em que entrou e sobe a versão do modelo', async () => {
    const { service, tx } = buildService();
    const created = await service.addItem('cat-1', { text: ' Extintor ' });

    expect(tx.template.update).toHaveBeenCalledWith(bumped);
    expect(created).toMatchObject({ addedInVersion: 5, text: 'Extintor', order: 2 });
  });

  it('editar item sobe a versão do modelo', async () => {
    const { service, tx } = buildService();
    await service.updateItem('item-1', { text: 'Pneus dianteiros' });
    expect(tx.templateItem.update).toHaveBeenCalled();
    expect(tx.template.update).toHaveBeenCalledWith(bumped);
  });

  it('item sem respostas é apagado de verdade', async () => {
    const { service, tx } = buildService();
    await service.removeItem('item-1');
    expect(tx.templateItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    expect(tx.templateItem.update).not.toHaveBeenCalled();
    expect(tx.template.update).toHaveBeenCalledWith(bumped);
  });

  it('item com respostas só é desativado', async () => {
    const { service, prisma, tx } = buildService();
    prisma.checklistAnswer.count.mockResolvedValue(7);

    await service.removeItem('item-1');

    expect(tx.templateItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { isActive: false } });
    expect(tx.templateItem.delete).not.toHaveBeenCalled();
  });

  it('item já removido não pode ser editado', async () => {
    const { service, prisma } = buildService();
    prisma.templateItem.findFirst.mockResolvedValue(null);
    await expect(service.updateItem('item-1', { text: 'x' })).rejects.toThrow('Item não encontrado');
    expect(prisma.templateItem.findFirst.mock.calls[0][0].where).toEqual({ id: 'item-1', isActive: true });
  });

  it('seção com respostas é desativada junto com seus itens', async () => {
    const { service, prisma, tx } = buildService();
    prisma.checklistAnswer.count.mockResolvedValue(3);

    await service.removeCategory('cat-1');

    expect(prisma.checklistAnswer.count).toHaveBeenCalledWith({ where: { item: { categoryId: 'cat-1' } } });
    expect(tx.templateItem.updateMany).toHaveBeenCalledWith({ where: { categoryId: 'cat-1' }, data: { isActive: false } });
    expect(tx.templateCategory.update).toHaveBeenCalledWith({ where: { id: 'cat-1' }, data: { isActive: false } });
    expect(tx.templateCategory.delete).not.toHaveBeenCalled();
    expect(tx.template.update).toHaveBeenCalledWith(bumped);
  });

  it('seção sem respostas é apagada', async () => {
    const { service, tx } = buildService();
    await service.removeCategory('cat-1');
    expect(tx.templateCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
  });

  it('modelo com checklists registrados não pode ser excluído', async () => {
    const { service, prisma } = buildService();
    prisma.checklist.count.mockResolvedValue(12);

    await expect(service.remove('tpl-1')).rejects.toThrow(ConflictException);
    expect(prisma.template.delete).not.toHaveBeenCalled();
  });

  it('modelo sem checklists pode ser excluído', async () => {
    const { service, prisma } = buildService();
    await service.remove('tpl-1');
    expect(prisma.template.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } });
  });

  it('o construtor de modelos só mostra seções e itens ativos', async () => {
    const { service, prisma } = buildService();
    await service.findOne('tpl-1');
    const include = prisma.template.findUnique.mock.calls[0][0].include;
    expect(include.categories.where).toEqual({ isActive: true });
    expect(include.categories.include.items.where).toEqual({ isActive: true });
  });
});

describe('TemplateService — copiar para outra frente', () => {
  const source = {
    id: 'tpl-1',
    tenantId: 't1',
    name: 'Diário',
    description: 'Antes de sair',
    version: 7,
    categories: [
      {
        name: 'Rodagem',
        order: 0,
        items: [
          { text: 'Pneus', type: 'PASS_FAIL', isRequired: true, isCritical: true, photoRequirement: 'ON_NON_COMPLIANCE', order: 0, addedInVersion: 5 },
          { text: 'Km', type: 'NUMBER', isRequired: false, isCritical: false, photoRequirement: 'NONE', order: 1, addedInVersion: 1 },
        ],
      },
    ],
  };

  it('cria um modelo novo, como rascunho, na versão 1, com as seções e itens ativos', async () => {
    const { prisma, service } = buildService();
    prisma.template.findUnique.mockResolvedValue(source);
    (prisma.template as any).create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'copia', ...data }));

    const copy = await service.copy('tpl-1', {});

    // Só busca seções e itens ativos (os removidos que guardam histórico não vão para a cópia).
    expect(prisma.template.findUnique.mock.calls[0][0].include.categories.where).toEqual({ isActive: true });
    const data = (prisma.template as any).create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Diário (cópia)', description: 'Antes de sair', isActive: false, version: 1, allUnits: true });
    const category = data.categories.create[0];
    expect(category).toMatchObject({ tenantId: 't1', name: 'Rodagem', order: 0 });
    expect(category.items.create).toEqual([
      { tenantId: 't1', text: 'Pneus', type: 'PASS_FAIL', isRequired: true, isCritical: true, photoRequirement: 'ON_NON_COMPLIANCE', order: 0, addedInVersion: 1 },
      { tenantId: 't1', text: 'Km', type: 'NUMBER', isRequired: false, isCritical: false, photoRequirement: 'NONE', order: 1, addedInVersion: 1 },
    ]);
    expect(copy.id).toBe('copia');
  });

  it('usa o nome informado', async () => {
    const { prisma, service } = buildService();
    prisma.template.findUnique.mockResolvedValue(source);
    (prisma.template as any).create = vi.fn().mockResolvedValue({ id: 'copia' });
    await service.copy('tpl-1', { name: '  Diário Mina Norte ' });
    expect((prisma.template as any).create.mock.calls[0][0].data.name).toBe('Diário Mina Norte');
  });

  it('modelo que não existe ou de outra frente: não encontrado', async () => {
    const { prisma, service } = buildService();
    prisma.template.findUnique.mockResolvedValue(null);
    await expect(service.copy('outro', {})).rejects.toThrow('Template não encontrado');
  });
});

