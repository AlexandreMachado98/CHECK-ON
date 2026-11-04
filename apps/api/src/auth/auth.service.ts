import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { refreshTokenTtlDays } from '../config/env';
import * as bcrypt from 'bcrypt';

/**
 * Janela em que um refresh token recém-trocado ainda é aceito.
 * Cobre o caso do celular que enviou o refresh, mas perdeu a resposta por falha de rede.
 */
export const REFRESH_REUSE_WINDOW_MS = 60 * 1000;

const INVALID_SESSION = 'Sessão expirada. Faça login novamente.';

type UserWithAccess = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  tenantId: string;
  employeeId?: string | null;
  tenant: { name: string; isActive: boolean };
  role: { name: string; permissions: unknown };
};

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { tenant: true, role: true },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      throw new UnauthorizedException('Credenciais inválidas ou conta inativa');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens(user, randomUUID());
  }

  /**
   * Troca um refresh token válido por um novo par (rotação).
   * Reapresentar um token já trocado fora da janela de tolerância derruba todas as sessões daquele login.
   */
  async refresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      include: { user: { include: { tenant: true, role: true } } },
    });

    if (!record) throw new UnauthorizedException(INVALID_SESSION);

    const now = Date.now();

    if (record.revokedAt) {
      const withinReuseWindow = now - record.revokedAt.getTime() <= REFRESH_REUSE_WINDOW_MS;
      if (!withinReuseWindow) {
        await this.revokeFamily(record.familyId);
        throw new UnauthorizedException(INVALID_SESSION);
      }
    }

    if (record.expiresAt.getTime() <= now) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const { user } = record;
    if (!user.isActive || !user.tenant.isActive) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Conta inativa. Procure o administrador.');
    }

    if (!record.revokedAt) {
      // Só um pedido concorrente consegue revogar; o outro cai na janela de tolerância acima na próxima vez.
      await this.prisma.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date(now) },
      });
    }

    return this.issueTokens(user, record.familyId);
  }

  /** Encerra a sessão do aparelho. Não falha se o token já estiver inválido. */
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Dados do usuário logado, incluindo o funcionário vinculado (motorista). */
  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: {
        tenant: true,
        role: true,
        employee: {
          select: { id: true, name: true, matricula: true, jobTitle: true, photoUrl: true, isActive: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado ou inativo.');

    return {
      ...this.toUserResponse(user),
      permissions: user.role.permissions,
      employee: user.employee && user.employee.isActive ? user.employee : null,
    };
  }

  private async issueTokens(user: UserWithAccess, familyId: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role.name,
      permissions: user.role.permissions,
    };

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlDays() * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: refreshToken,
      refresh_token_expires_at: refreshExpiresAt.toISOString(),
      user: this.toUserResponse(user),
    };
  }

  private toUserResponse(user: UserWithAccess) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      role: user.role.name,
      employeeId: user.employeeId ?? null,
    };
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
