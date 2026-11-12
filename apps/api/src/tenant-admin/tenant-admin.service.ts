import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ADMIN_EMPRESA, DEFAULT_TENANT_ROLES } from '../role/role-definitions';

/** Validade do acesso do super admin a uma empresa. Sem refresh: expirou, volta para a plataforma. */
export const TENANT_ACCESS_TTL_SECONDS = 60 * 60;

export type PlatformAdmin = { id: string; email: string };
export type AccessContext = { ip?: string; userAgent?: string };

const TENANT_SELECT = {
  id: true,
  name: true,
  cnpj: true,
  plan: true,
  isActive: true,
  createdAt: true,
  _count: { select: { users: true, vehicles: true, employees: true } },
} as const;

@Injectable()
export class TenantAdminService {
  private readonly logger = new Logger(TenantAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Cria a empresa já pronta para uso: perfis padrão e o primeiro administrador, tudo ou nada.
   */
  async create(dto: CreateTenantDto) {
    if (dto.cnpj) {
      const existing = await this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj }, select: { id: true } });
      if (existing) throw new ConflictException('Este CNPJ já está cadastrado em outra empresa.');
    }
    // E-mail é único na plataforma. SQL direto porque a extensão limitaria a busca à empresa do super admin.
    const emailTaken = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE email = ${dto.adminEmail} LIMIT 1`;
    if (emailTaken.length > 0) throw new ConflictException('O e-mail do administrador já está em uso.');

    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: { name: dto.name, cnpj: dto.cnpj, plan: dto.plan ?? 'STARTER' },
        select: { id: true },
      });

      // A extensão do Prisma grava o tenantId do contexto da requisição (o do super admin).
      // Aqui o contexto passa a ser a empresa nova, para perfis e usuário nascerem nela.
      await this.cls.run(async () => {
        this.cls.set('tenantId', created.id);
        await tx.role.createMany({
          data: DEFAULT_TENANT_ROLES.map((role) => ({
            name: role.name,
            permissions: JSON.stringify(role.permissions),
            isSystem: true,
          })) as never,
        });
        const adminRole = await tx.role.findFirst({ where: { name: ADMIN_EMPRESA }, select: { id: true } });
        if (!adminRole) throw new Error('Perfil ADMIN_EMPRESA não foi criado.');
        await tx.user.create({
          data: { name: dto.adminName, email: dto.adminEmail, passwordHash, roleId: adminRole.id } as never,
        });
      });

      return tx.tenant.findUniqueOrThrow({ where: { id: created.id }, select: TENANT_SELECT });
    });

    return tenant;
  }

  async findAll() {
    const platformTenantId = this.cls.get<string>('tenantId');
    const tenants = await this.prisma.tenant.findMany({ select: TENANT_SELECT, orderBy: { createdAt: 'desc' } });
    return tenants.map((tenant) => ({ ...tenant, isPlatform: tenant.id === platformTenantId }));
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    if (dto.isActive === false && id === this.cls.get<string>('tenantId')) {
      throw new BadRequestException('A empresa da plataforma não pode ser desativada.');
    }
    // Empresa desativada: o login e a renovação de sessão já recusam usuários dela (auth.service).
    return this.prisma.tenant.update({ where: { id }, data: dto, select: TENANT_SELECT });
  }

  /**
   * "Acessar empresa": token de administrador daquela empresa, válido por 1 hora, para o super admin.
   * O token carrega impersonatedBy e cada acesso fica registrado em AdminAccessLog.
   */
  async access(tenantId: string, admin: PlatformAdmin, context: AccessContext) {
    const platformTenantId = this.cls.get<string>('tenantId');
    if (tenantId === platformTenantId) {
      throw new BadRequestException('A empresa da plataforma não tem painel de operação.');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, isActive: true } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    if (!tenant.isActive) throw new BadRequestException('Empresa desativada. Reative-a antes de acessar.');

    // Busca no contexto da plataforma (a extensão do Prisma limita à empresa do super admin).
    const adminUser = await this.prisma.user.findFirst({ where: { id: admin.id, isActive: true }, select: { id: true, name: true, email: true } });
    if (!adminUser) throw new NotFoundException('Usuário administrador não encontrado.');

    const expiresAt = new Date(Date.now() + TENANT_ACCESS_TTL_SECONDS * 1000);
    await this.prisma.adminAccessLog.create({
      data: {
        adminUserId: adminUser.id,
        tenantId: tenant.id,
        ip: context.ip?.slice(0, 100),
        userAgent: context.userAgent?.slice(0, 300),
        expiresAt,
      },
    });
    this.logger.log(`Super admin ${adminUser.email} acessou a empresa "${tenant.name}" (${tenant.id})`);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: adminUser.id,
        email: adminUser.email,
        tenantId: tenant.id,
        role: ADMIN_EMPRESA,
        permissions: '["*"]',
        impersonatedBy: adminUser.id,
      },
      { expiresIn: TENANT_ACCESS_TTL_SECONDS },
    );

    return {
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        tenantId: tenant.id,
        tenantName: tenant.name,
        role: ADMIN_EMPRESA,
        impersonating: true,
      },
    };
  }

  /** Últimos acessos de super admins às empresas, do mais recente para o mais antigo. */
  async accessLogs() {
    return this.prisma.adminAccessLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        ip: true,
        adminUser: { select: { name: true, email: true } },
        tenant: { select: { id: true, name: true } },
      },
    });
  }
}
