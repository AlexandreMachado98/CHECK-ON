import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AppLoginDto } from './dto/app-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LOCK_MINUTES, MAX_FAILED_LOGINS, ipIsBlocked, registerIpFailure } from './password';
import { SessionGuardCache } from './session-guard.cache';
import { refreshTokenTtlDays } from '../config/env';
import * as bcrypt from 'bcrypt';
import { SUBSCRIPTION_EXPIRED_MESSAGE, subscriptionExpired, subscriptionInfo } from '../subscription/subscription';

/**
 * Janela em que um refresh token recém-trocado ainda é aceito.
 * Cobre o caso do celular que enviou o refresh, mas perdeu a resposta por falha de rede.
 */
export const REFRESH_REUSE_WINDOW_MS = 60 * 1000;

const INVALID_SESSION = 'Sessão expirada. Faça login novamente.';

type UserWithAccess = {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  tenantId: string;
  employeeId?: string | null;
  mustChangePassword?: boolean;
  tenant: { name: string; isActive: boolean; code?: string | null };
  role: { name: string; permissions: unknown };
};

const WRONG_CREDENTIALS = 'Login ou senha incorretos.';

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionCache: SessionGuardCache,
  ) {}

  async login(loginDto: LoginDto, ip?: string) {
    if (ipIsBlocked(ip)) {
      throw new HttpException('Muitas tentativas de login a partir desta rede. Aguarde 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.findLoginUser(loginDto);

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(`Muitas tentativas com senha errada. Tente de novo em ${minutes} minuto${minutes === 1 ? '' : 's'}.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    // A senha é conferida antes de dizer que a conta está bloqueada: assim ninguém descobre
    // quais logins existem testando senhas erradas.
    const isPasswordValid = user ? await bcrypt.compare(loginDto.password, user.passwordHash) : false;
    if (!user || !isPasswordValid) {
      registerIpFailure(ip);
      if (user) await this.registerFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthorizedException(WRONG_CREDENTIALS);
    }
    if (!user.tenant.isActive) {
      throw new UnauthorizedException('A empresa desta conta está desativada. Procure o suporte do CHECK-ON.');
    }
    if (subscriptionExpired(user.tenant)) throw new UnauthorizedException(SUBSCRIPTION_EXPIRED_MESSAGE);
    if (!user.isActive) {
      throw new UnauthorizedException('Seu acesso está bloqueado. Procure o administrador da sua empresa.');
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }
    return this.issueTokens(user, randomUUID());
  }

  /**
   * Login do aplicativo: código da empresa + matrícula, sem senha (decisão do cliente).
   * Só entra quem teve o acesso criado pela empresa. O token é marcado como "app" e só vale
   * para as rotas do aplicativo (inspeção, veículos, NCs, fotos): não abre o portal.
   */
  async appLogin(dto: AppLoginDto, ip?: string) {
    if (ipIsBlocked(ip)) {
      throw new HttpException('Muitas tentativas de login a partir desta rede. Aguarde 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const tenant = await this.prisma.tenant.findFirst({ where: { code: { equals: dto.companyCode, mode: 'insensitive' } }, select: { id: true } });
    const matches = tenant
      ? await this.prisma.user.findMany({
          where: { tenantId: tenant.id, employee: { matricula: { equals: dto.matricula, mode: 'insensitive' } } },
          include: { tenant: true, role: true, employee: { select: { isActive: true } } },
          take: 2,
        })
      : [];
    if (matches.length > 1) {
      throw new BadRequestException('Há mais de um colaborador com esta matrícula. Peça à empresa para corrigir o cadastro.');
    }
    const user = matches[0];
    if (!user) {
      registerIpFailure(ip);
      throw new UnauthorizedException('Código da empresa ou matrícula não encontrados. Confira com a sua empresa se o seu acesso foi criado.');
    }
    if (!user.tenant.isActive) throw new UnauthorizedException('A empresa desta conta está desativada. Procure o suporte do CHECK-ON.');
    if (subscriptionExpired(user.tenant)) throw new UnauthorizedException(SUBSCRIPTION_EXPIRED_MESSAGE);
    if (!user.isActive || user.employee?.isActive === false) {
      throw new UnauthorizedException('Seu acesso está bloqueado. Procure o administrador da sua empresa.');
    }
    return this.issueTokens(user, randomUUID(), 'app');
  }

  /**
   * E-mail (sem diferenciar maiúsculas: no celular o teclado costuma pôr a primeira letra em maiúscula)
   * ou código da empresa + matrícula. Sem empresa no contexto ainda: as buscas não passam pelo filtro de tenant.
   */
  private async findLoginUser(dto: LoginDto) {
    const include = { tenant: true, role: true } as const;
    if (dto.email) {
      return this.prisma.user.findFirst({ where: { email: { equals: dto.email.trim(), mode: 'insensitive' } }, include });
    }
    const tenant = await this.prisma.tenant.findFirst({ where: { code: { equals: dto.companyCode!, mode: 'insensitive' } }, select: { id: true } });
    if (!tenant) return null;
    const matches = await this.prisma.user.findMany({
      where: { tenantId: tenant.id, employee: { matricula: { equals: dto.matricula!, mode: 'insensitive' } } },
      include,
      take: 2,
    });
    // Matrícula repetida (cadastro antigo): não dá para saber quem é. A empresa precisa corrigir o cadastro.
    if (matches.length > 1) {
      throw new BadRequestException('Há mais de um colaborador com esta matrícula. Peça à empresa para corrigir o cadastro.');
    }
    return matches[0] ?? null;
  }

  private async registerFailedLogin(userId: string, previousFailures: number) {
    const failures = previousFailures + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await this.prisma.user.update({
      where: { id: userId },
      data: lock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
        : { failedLoginCount: failures },
    });
  }

  /**
   * O próprio usuário troca a senha (inclusive a provisória). Encerra os outros logins dele,
   * no painel e no aplicativo, e devolve tokens novos para este aparelho continuar conectado.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    // Sem filtro de tenant: o usuário é o do token. Inclui o caso do super admin dentro de outra empresa.
    const [user] = await this.prisma.$queryRaw<{ id: string; passwordHash: string }[]>`
      SELECT id, "passwordHash" FROM "User" WHERE id = ${userId}`;
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('A senha atual não confere.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "User" SET "passwordHash" = ${await bcrypt.hash(dto.newPassword, 10)}, "mustChangePassword" = false,
          "passwordChangedAt" = ${now}, "failedLoginCount" = 0, "lockedUntil" = NULL, "updatedAt" = ${now}
        WHERE id = ${userId}`,
      this.prisma.$executeRaw`UPDATE "RefreshToken" SET "revokedAt" = ${now} WHERE "userId" = ${userId} AND "revokedAt" IS NULL`,
    ]);
    this.sessionCache.invalidateUser(userId);
    // O token novo precisa ser de um segundo depois da troca (o "iat" do JWT é em segundos).
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1000 - (Date.now() % 1000))));
    const fresh = await this.prisma.user.findFirstOrThrow({ where: { id: userId }, include: { tenant: true, role: true } });
    return this.issueTokens(fresh, randomUUID());
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
    // Assinatura vencida: recusa sem encerrar a sessão (renovou, o aplicativo volta a funcionar).
    if (subscriptionExpired(user.tenant)) throw new UnauthorizedException(SUBSCRIPTION_EXPIRED_MESSAGE);

    if (!record.revokedAt) {
      // Só um pedido concorrente consegue revogar; o outro cai na janela de tolerância acima na próxima vez.
      await this.prisma.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date(now) },
      });
    }

    // A renovação mantém o tipo de sessão: o login sem senha do app nunca vira acesso ao portal.
    return this.issueTokens(user, record.familyId, record.channel === 'app' ? 'app' : null);
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
      // Situação da assinatura: o portal mostra o aviso de vencimento e de carência.
      subscription: subscriptionInfo(user.tenant),
      permissions: user.role.permissions,
      employee: user.employee && user.employee.isActive ? user.employee : null,
    };
  }

  private async issueTokens(user: UserWithAccess, familyId: string, channel: 'app' | null = null) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role.name,
      permissions: user.role.permissions,
      // "app": sessão do aplicativo sem senha, limitada às rotas do app (SessionGuardCache).
      ...(channel ? { channel } : {}),
    };

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlDays() * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        channel,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: refreshToken,
      refresh_token_expires_at: refreshExpiresAt.toISOString(),
      user: this.toUserResponse(user, channel),
    };
  }

  private toUserResponse(user: UserWithAccess, channel: 'app' | null = null) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantCode: user.tenant.code ?? null,
      role: user.role.name,
      employeeId: user.employeeId ?? null,
      mustChangePassword: channel === 'app' ? false : user.mustChangePassword ?? false,
    };
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
