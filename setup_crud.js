const fs = require('fs');
const path = require('path');

const apiSrc = path.join(__dirname, 'apps/api/src');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Decorator and Guard for Roles
ensureDir(path.join(apiSrc, 'auth/decorators'));
fs.writeFileSync(path.join(apiSrc, 'auth/decorators/roles.decorator.ts'), `import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
`);

fs.writeFileSync(path.join(apiSrc, 'auth/guards/roles.guard.ts'), `import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true; // Sem restrição de rota
    }
    
    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.role) {
      throw new ForbiddenException('Acesso negado: Perfil não identificado');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Acesso negado: Perfil sem permissão para esta ação');
    }
    
    return true;
  }
}
`);

// 2. Tenant Admin Module (For SUPER_ADMIN)
ensureDir(path.join(apiSrc, 'tenant-admin/dto'));
fs.writeFileSync(path.join(apiSrc, 'tenant-admin/dto/create-tenant.dto.ts'), `import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
`);

fs.writeFileSync(path.join(apiSrc, 'tenant-admin/tenant-admin.service.ts'), `import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    if (createTenantDto.cnpj) {
      const existing = await this.prisma.tenant.findUnique({ where: { cnpj: createTenantDto.cnpj } });
      if (existing) {
        throw new ConflictException('CNPJ já cadastrado em outra empresa');
      }
    }
    
    return this.prisma.tenant.create({
      data: createTenantDto,
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
`);

fs.writeFileSync(path.join(apiSrc, 'tenant-admin/tenant-admin.controller.ts'), `import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin/tenants')
export class TenantAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  @Post()
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantAdminService.create(createTenantDto);
  }

  @Get()
  findAll() {
    return this.tenantAdminService.findAll();
  }
}
`);

fs.writeFileSync(path.join(apiSrc, 'tenant-admin/tenant-admin.module.ts'), `import { Module } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { TenantAdminController } from './tenant-admin.controller';

@Module({
  controllers: [TenantAdminController],
  providers: [TenantAdminService],
})
export class TenantAdminModule {}
`);

// 3. User Module (For ADMIN/GESTOR inside a Tenant)
ensureDir(path.join(apiSrc, 'user/dto'));
fs.writeFileSync(path.join(apiSrc, 'user/dto/create-user.dto.ts'), `import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsString()
  roleId: string;
}
`);

fs.writeFileSync(path.join(apiSrc, 'user/user.service.ts'), `import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // O Prisma automaticamente filtra o e adiciona tenantId devido à extensão RLS.
    // Mas o email é único globalmente, vamos checar.
    const existing = await this.prisma.user.findUnique({ where: { email: createUserDto.email } });
    if (existing) {
      throw new ConflictException('E-mail já está em uso');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    const { password, ...data } = createUserDto;

    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        tenantId: true,
      }
    });
  }

  async findAll() {
    // Retornará apenas usuários da mesma empresa (tenant) devido à extensão.
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
`);

fs.writeFileSync(path.join(apiSrc, 'user/user.controller.ts'), `import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }
}
`);

fs.writeFileSync(path.join(apiSrc, 'user/user.module.ts'), `import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
`);

// 4. Update AppModule
const appModuleCode = `import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantAdminModule } from './tenant-admin/tenant-admin.module';
import { UserModule } from './user/user.module';
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
    TenantAdminModule,
    UserModule,
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

console.log('CRUDs and Guards scaffolded.');
