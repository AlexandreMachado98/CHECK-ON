import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SessionGuardCache } from '../auth/session-guard.cache';

const COMPANY_SELECT = {
  id: true,
  name: true,
  cnpj: true,
  plan: true,
  isActive: true,
  address: true,
  contactEmail: true,
  phone: true,
  autoBlockCriticalNc: true,
  sessionsRevokedAt: true,
  storageUsed: true,
  createdAt: true,
  _count: { select: { users: true, vehicles: true, employees: true, checklists: true } },
} as const;

/** A empresa de quem está logado: dados de contato, preferências, plano/uso e segurança. */
@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly sessionCache: SessionGuardCache,
  ) {}

  private tenantId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new ForbiddenException('Empresa não identificada na sessão.');
    return id;
  }

  get() {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: this.tenantId() }, select: COMPANY_SELECT });
  }

  async update(dto: UpdateCompanyDto) {
    const id = this.tenantId();
    if (dto.cnpj) {
      const other = await this.prisma.tenant.findFirst({ where: { cnpj: dto.cnpj, NOT: { id } }, select: { id: true } });
      if (other) throw new ConflictException('Este CNPJ já está cadastrado em outra empresa.');
    }
    return this.prisma.tenant.update({ where: { id }, data: dto, select: COMPANY_SELECT });
  }

  /**
   * Derruba todos os acessos da empresa: logins do painel e do app precisam entrar de novo.
   * Os tokens emitidos antes de agora deixam de valer (checado a cada requisição) e as sessões
   * de longa duração do app (refresh tokens) são revogadas.
   */
  async revokeAllSessions() {
    const id = this.tenantId();
    const now = new Date();
    const [, revoked] = await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id }, data: { sessionsRevokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { user: { tenantId: id }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    this.sessionCache.invalidateTenant(id);
    return { revokedAt: now.toISOString(), appSessions: revoked.count };
  }
}
