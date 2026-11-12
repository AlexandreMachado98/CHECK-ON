import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ROLE_LABELS, assignableRoleNames } from '../role/role-definitions';

/** Quem faz a alteração (vem do token). */
export type Requester = { id: string; role: string };

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  roleId: true,
  role: { select: { id: true, name: true } },
} as const;

type UserRow = { role: { id: string; name: string } } & Record<string, unknown>;

function withRoleLabel<T extends UserRow>(user: T) {
  return { ...user, role: { ...user.role, label: ROLE_LABELS[user.role.name] ?? user.role.name } };
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto, requester: Requester) {
    await this.assertAssignableRole(dto.roleId, requester);

    // O e-mail é único em toda a plataforma, não só na empresa.
    const existing = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE email = ${dto.email} LIMIT 1`;
    if (existing.length > 0) throw new ConflictException('Este e-mail já está em uso.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      // O tenantId é preenchido pela extensão do Prisma com a empresa de quem está logado.
      data: { name: dto.name.trim(), email: dto.email, passwordHash, roleId: dto.roleId } as never,
      select: USER_SELECT,
    });
    return withRoleLabel(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: 'desc' } });
    return users.map(withRoleLabel);
  }

  async update(id: string, dto: UpdateUserDto, requester: Requester) {
    const target = await this.prisma.user.findFirst({ where: { id }, select: { id: true, role: { select: { name: true } } } });
    if (!target) throw new NotFoundException('Usuário não encontrado.');

    // Gestor não altera administradores da empresa (nem SUPER_ADMIN, que nem aparece aqui).
    if (!assignableRoleNames(requester.role).includes(target.role.name)) {
      throw new ForbiddenException('Seu perfil não pode alterar este usuário.');
    }
    if (id === requester.id) {
      if (dto.isActive === false) throw new BadRequestException('Você não pode bloquear o seu próprio acesso.');
      if (dto.roleId) throw new BadRequestException('Você não pode alterar o seu próprio perfil.');
    }
    if (dto.roleId) await this.assertAssignableRole(dto.roleId, requester);

    const data: { name?: string; roleId?: string; isActive?: boolean; passwordHash?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.roleId !== undefined) data.roleId = dto.roleId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data, select: USER_SELECT });
      // Bloqueio ou troca de senha encerram as sessões abertas (inclusive no app).
      if (data.isActive === false || data.passwordHash) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return user;
    });
    return withRoleLabel(updated);
  }

  /** O perfil precisa ser da mesma empresa e estar entre os que quem pede pode atribuir. */
  private async assertAssignableRole(roleId: string, requester: Requester) {
    // A extensão do Prisma restringe a busca à empresa de quem está logado.
    const role = await this.prisma.role.findFirst({ where: { id: roleId }, select: { name: true } });
    if (!role) throw new BadRequestException('Perfil inválido.');
    if (!assignableRoleNames(requester.role).includes(role.name)) {
      throw new ForbiddenException('Seu perfil não pode atribuir este perfil de acesso.');
    }
  }
}
