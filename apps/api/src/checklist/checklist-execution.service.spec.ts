import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ChecklistExecutionService, AuthenticatedUser } from './checklist-execution.service';

const motorista: AuthenticatedUser = { id: 'user-1', tenantId: 'tenant-1', role: 'MOTORISTA' };

const item = (overrides: Record<string, unknown>) => ({
  type: 'PASS_FAIL',
  isRequired: true,
  isCritical: false,
  isActive: true,
  addedInVersion: 1,
  ...overrides,
});

const template = {
  id: 'tpl-1',
  name: 'Inspeção diária',
  version: 3,
  categories: [
    {
      name: 'Rodagem',
      isActive: true,
      items: [
        item({ id: 'pneu', text: 'Pneus', isCritical: true }),
        item({ id: 'luz', text: 'Faróis' }),
      ],
    },
  ],
};

function templateWith(extraItems: Record<string, unknown>[]) {
  return {
    ...template,
    categories: [{ ...template.categories[0], items: [...template.categories[0].items, ...extraItems.map(item)] }],
  };
}

function baseDto(overrides: Record<string, unknown> = {}) {
  return {
    clientId: '6f1c2a8e-3b4d-4f5a-9c6b-7d8e9f0a1b2c',
    templateId: 'tpl-1',
    vehicleId: 'veh-1',
    completedAt: new Date(Date.now() - 60_000).toISOString(),
    answers: [
      { itemId: 'pneu', isCompliant: false },
      { itemId: 'luz', isCompliant: false },
    ],
    ...overrides,
  } as any;
}

function buildMocks() {
  const tx = {
    tenant: { findUnique: vi.fn().mockResolvedValue({ autoBlockCriticalNc: true }) },
    template: { findFirst: vi.fn().mockResolvedValue(template) },
    vehicle: {
      findFirst: vi.fn().mockResolvedValue({ id: 'veh-1', status: 'LIBERADO' }),
      update: vi.fn().mockResolvedValue({}),
    },
    employee: { findFirst: vi.fn().mockResolvedValue({ id: 'emp-1' }) },
    checklist: { create: vi.fn().mockResolvedValue({ id: 'chk-1' }) },
    checklistAnswer: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: `ans-${data.itemId}` })),
      update: vi.fn().mockResolvedValue({}),
    },
    nonConformity: {
      // "luz" já tem NC ativa (reincidência); "pneu" não.
      findFirst: vi.fn().mockImplementation(({ where }) =>
        Promise.resolve(where.itemId === 'luz' ? { id: 'nc-luz', severity: 'MEDIUM' } : null),
      ),
      findMany: vi.fn().mockResolvedValue([{ severity: 'CRITICAL' }, { severity: 'MEDIUM' }]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    checklist: { findFirst: vi.fn().mockResolvedValue(null) },
    user: { findFirst: vi.fn().mockResolvedValue({ employeeId: 'emp-1' }) },
    $transaction: vi.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const cls = { get: vi.fn().mockReturnValue('tenant-1') };
  const storage = { isChecklistPhotoUrl: vi.fn().mockReturnValue(true) };
  const service = new ChecklistExecutionService(prisma as any, cls as any, storage as any);
  return { service, prisma, tx, storage };
}

describe('ChecklistExecutionService', () => {
  it('cria execução, abre NC nova, agrupa reincidência e bloqueia o veículo', async () => {
    const { service, tx } = buildMocks();
    const result = await service.submit(baseDto(), motorista);

    expect(result).toMatchObject({ status: 'CREATED', ncsOpened: 1, ncsRecurrent: 1, vehicleStatus: 'BLOQUEADO' });
    expect(tx.checklist.create.mock.calls[0][0].data).toMatchObject({ tenantId: 'tenant-1', driverId: 'emp-1', status: 'COMPLETED' });
    expect(tx.nonConformity.create.mock.calls[0][0].data).toMatchObject({ itemId: 'pneu', severity: 'CRITICAL', vehicleId: 'veh-1' });
    expect(tx.nonConformity.update.mock.calls[0][0]).toMatchObject({ where: { id: 'nc-luz' } });
    expect(tx.checklistAnswer.update.mock.calls[0][0].data).toEqual({ recurrentNcId: 'nc-luz' });
    expect(tx.vehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-1' }, data: { status: 'BLOQUEADO' } });
  });

  it('devolve DUPLICATE sem gravar quando o clientId já existe', async () => {
    const { service, prisma } = buildMocks();
    prisma.checklist.findFirst.mockResolvedValue({ id: 'chk-antigo' });

    const result = await service.submit(baseDto(), motorista);

    expect(result).toEqual({ status: 'DUPLICATE', clientId: baseDto().clientId, checklistId: 'chk-antigo' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('trata corrida no índice único (P2002) como duplicado', async () => {
    const { service, prisma } = buildMocks();
    prisma.checklist.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'chk-concorrente' });
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' }),
    );

    const result = await service.submit(baseDto(), motorista);
    expect(result).toMatchObject({ status: 'DUPLICATE', checklistId: 'chk-concorrente' });
  });

  it('impede motorista de registrar em nome de outro', async () => {
    const { service } = buildMocks();
    await expect(service.submit(baseDto({ driverId: 'emp-outro' }), motorista)).rejects.toThrow('próprio nome');
  });

  it('no sync, separa erro de dados (REJECTED) de falha temporária (RETRY)', async () => {
    const { service, tx } = buildMocks();
    tx.vehicle.findFirst.mockResolvedValueOnce(null); // 1º: veículo inexistente
    tx.checklist.create.mockRejectedValueOnce(new Error('disco cheio')); // 2º: erro inesperado

    const results = await service.sync(
      [
        baseDto({ clientId: '11111111-1111-4111-8111-111111111111' }),
        baseDto({ clientId: '22222222-2222-4222-8222-222222222222' }),
        baseDto({ clientId: '33333333-3333-4333-8333-333333333333' }),
      ],
      motorista,
    );

    expect(results.map((r) => r.status)).toEqual(['REJECTED', 'RETRY', 'CREATED']);
  });

  it('recusa foto que não foi enviada pela plataforma', async () => {
    const { service, storage, tx } = buildMocks();
    storage.isChecklistPhotoUrl.mockReturnValue(false);
    const dto = baseDto({
      answers: [
        { itemId: 'pneu', isCompliant: false, photoUrl: 'https://site-qualquer.com/foto.jpg' },
        { itemId: 'luz', isCompliant: true },
      ],
    });
    // Com uma lista de erros, o Nest guarda as mensagens no corpo da resposta, não em error.message.
    const error = await service.submit(dto, motorista).catch((e) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(JSON.stringify(error.getResponse())).toContain('não foi enviada por esta plataforma');
    expect(tx.checklist.create).not.toHaveBeenCalled();
  });

  describe('versão do modelo e histórico', () => {
    it('grava a versão, o nome do modelo e a cópia de cada pergunta', async () => {
      const { service, tx } = buildMocks();
      await service.submit(baseDto({ templateVersion: 3 }), motorista);

      expect(tx.checklist.create.mock.calls[0][0].data).toMatchObject({ templateVersion: 3, templateName: 'Inspeção diária' });
      expect(tx.checklistAnswer.create.mock.calls[0][0].data).toMatchObject({
        itemId: 'pneu',
        itemText: 'Pneus',
        itemType: 'PASS_FAIL',
        itemIsCritical: true,
        categoryName: 'Rodagem',
      });
    });

    it('sem templateVersion, usa a versão atual', async () => {
      const { service, tx } = buildMocks();
      await service.submit(baseDto(), motorista);
      expect(tx.checklist.create.mock.calls[0][0].data.templateVersion).toBe(3);
    });

    it('checklist de versão anterior não precisa responder item incluído depois', async () => {
      const { service, tx } = buildMocks();
      tx.template.findFirst.mockResolvedValue(templateWith([{ id: 'extintor', text: 'Extintor', addedInVersion: 3 }]));

      const result = await service.submit(baseDto({ templateVersion: 2 }), motorista);
      expect(result.status).toBe('CREATED');
    });

    it('na versão atual, o item novo obrigatório continua exigido', async () => {
      const { service, tx } = buildMocks();
      tx.template.findFirst.mockResolvedValue(templateWith([{ id: 'extintor', text: 'Extintor', addedInVersion: 3 }]));

      const error = await service.submit(baseDto({ templateVersion: 3 }), motorista).catch((e) => e);
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(JSON.stringify(error.getResponse())).toContain('Extintor');
    });

    it('aceita resposta a item removido depois do download e abre a NC normalmente', async () => {
      const { service, tx } = buildMocks();
      tx.template.findFirst.mockResolvedValue(templateWith([{ id: 'antigo', text: 'Item antigo', isActive: false }]));

      const result = await service.submit(
        baseDto({
          templateVersion: 2,
          answers: [
            { itemId: 'pneu', isCompliant: true },
            { itemId: 'luz', isCompliant: true },
            { itemId: 'antigo', isCompliant: false },
          ],
        }),
        motorista,
      );

      expect(result).toMatchObject({ status: 'CREATED', ncsOpened: 1 });
      expect(tx.nonConformity.create.mock.calls[0][0].data.itemId).toBe('antigo');
    });

    it('item removido deixa de ser obrigatório', async () => {
      const { service, tx } = buildMocks();
      tx.template.findFirst.mockResolvedValue(templateWith([{ id: 'antigo', text: 'Item antigo', isActive: false }]));

      const result = await service.submit(baseDto(), motorista);
      expect(result.status).toBe('CREATED');
    });
  });
});
