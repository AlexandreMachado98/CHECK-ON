import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TENANT_ROLES, ROLE_LABELS, assignableRoleNames } from './role-definitions';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante que a empresa do usuário logado tem os perfis padrão.
   * Empresas criadas antes desta versão podem não ter todos; criar aqui evita uma migração de dados.
   */
  async ensureDefaultRoles() {
    const existing = await this.prisma.role.findMany({ select: { name: true } });
    const missing = DEFAULT_TENANT_ROLES.filter((role) => !existing.some((e) => e.name === role.name));
    if (missing.length === 0) return;
    // O tenantId é preenchido pela extensão do Prisma; skipDuplicates cobre duas requisições simultâneas.
    await this.prisma.role.createMany({
      data: missing.map((role) => ({ name: role.name, permissions: JSON.stringify(role.permissions), isSystem: true })) as never,
      skipDuplicates: true,
    });
  }

  /** Perfis que quem está logado pode atribuir a outros usuários da empresa. */
  async findAssignable(requesterRole: string) {
    await this.ensureDefaultRoles();
    const allowed = assignableRoleNames(requesterRole);
    const roles = await this.prisma.role.findMany({
      where: { name: { in: allowed } },
      select: { id: true, name: true },
    });
    return roles
      .sort((a, b) => allowed.indexOf(a.name) - allowed.indexOf(b.name))
      .map((role) => ({ ...role, label: ROLE_LABELS[role.name] ?? role.name }));
  }
}
