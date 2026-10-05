const fs = require('fs');
const path = require('path');

const apiSrc = path.join(__dirname, 'apps/api/src');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Prisma Service with Client Extension
const prismaServiceCode = `import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
              args.where = { ...args.where, tenantId };
            } 
            // Operações de Criação
            else if (['create', 'createMany'].includes(operation)) {
              if (args.data) {
                if (Array.isArray(args.data)) {
                  args.data = args.data.map(d => ({ ...d, tenantId }));
                } else {
                  args.data = { ...args.data, tenantId };
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
`;
fs.writeFileSync(path.join(apiSrc, 'prisma/prisma.service.ts'), prismaServiceCode);

// 2. Tenant Interceptor
ensureDir(path.join(apiSrc, 'tenant'));
const interceptorCode = `import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // O JwtAuthGuard coloca o payload decodificado em req.user
    if (request.user && request.user.tenantId) {
      this.cls.set('tenantId', request.user.tenantId);
    }
    
    return next.handle();
  }
}
`;
fs.writeFileSync(path.join(apiSrc, 'tenant/tenant.interceptor.ts'), interceptorCode);

// 3. Update AppModule to include ClsModule and global interceptor
const appModuleCode = `import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantInterceptor } from './tenant/tenant.interceptor';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
`;
fs.writeFileSync(path.join(apiSrc, 'app.module.ts'), appModuleCode);

console.log('Tenant isolation setup successfully.');
