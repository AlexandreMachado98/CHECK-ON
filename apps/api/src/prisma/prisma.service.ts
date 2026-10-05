import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';

// Modelos que possuem tenantId obrigatório
const MODELS_WITH_TENANT = ['Role', 'User', 'Employee', 'Unit', 'Department', 'Fleet', 'Vehicle', 'Checklist'];

export function createTenantPrismaClient() {
  const prisma = new PrismaClient();
  
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
            if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {
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
