import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';

// Modelos que possuem tenantId obrigatório
const MODELS_WITH_TENANT = ['Role', 'User', 'Employee', 'Unit', 'Department', 'Fleet', 'Vehicle', 'Checklist', 'Template', 'TemplateCategory', 'TemplateItem', 'ChecklistAnswer', 'NonConformity'];

// Toda operação que lê ou altera registros existentes recebe o filtro de tenant.
// groupBy/aggregate e as variantes *OrThrow também, para nenhuma consulta escapar do isolamento.
const TENANT_FILTERED_OPERATIONS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
];

export function createTenantPrismaClient() {
  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });
  const logger = new Logger('Prisma');
  prisma.$on('warn', (event) => logger.warn(event.message));
  prisma.$on('error', (event) => logger.error(event.message));
  
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Extrai o tenantId do contexto local da requisição atual
          const cls = ClsServiceManager.getClsService();
          const tenantId = cls?.get('tenantId');

          // Se a operação for em um modelo multi-tenant e houver um tenantId no contexto
          if (tenantId && MODELS_WITH_TENANT.includes(model)) {
            // Operações de Leitura / Atualização / Deleção
            if (TENANT_FILTERED_OPERATIONS.includes(operation)) {
              (args as any).where = { ...(args as any).where, tenantId };
            } 
            // Operações de Criação
            else if (['create', 'createMany'].includes(operation)) {
              if ((args as any).data) {
                if (Array.isArray((args as any).data)) {
                  (args as any).data = (args as any).data.map((d: any) => ({ ...d, tenantId }));
                } else {
                  (args as any).data = { ...(args as any).data, tenantId };
                }
              }
            }
          }
          return query(args);
        },
      },
    },
  });
}

const ExtendedPrismaClient = class {
  constructor() {
    return createTenantPrismaClient();
  }
} as new () => ReturnType<typeof createTenantPrismaClient>;

@Injectable()
export class PrismaService extends ExtendedPrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await (this as any).$connect();
  }
  async onModuleDestroy() {
    await (this as any).$disconnect();
  }
}
