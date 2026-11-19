import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NeonAuthClient } from './neon-auth.client';
import { SessionGuardCache } from './session-guard.cache';
import { ForgotPasswordDto, ResetPasswordWithCodeDto } from './dto/forgot-password.dto';

const WINDOW_MS = 15 * 60 * 1000;
/** Pedidos de código por e-mail e por IP, e tentativas de código por e-mail, a cada 15 minutos. */
const LIMITS = { requestPerEmail: 3, requestPerIp: 20, attemptPerEmail: 10 };

const GENERIC_SENT = 'Se este e-mail estiver cadastrado, você vai receber um código em instantes. Confira também a caixa de spam.';
const INVALID_CODE = 'Código inválido ou expirado. Peça um novo código.';

type Account = { id: string; name: string; isActive: boolean; tenantActive: boolean };

/**
 * "Esqueci minha senha" por e-mail. O Neon Auth envia e confere o código; a senha nova fica
 * só no CHECK-ON (o login continua sendo o nosso). Motorista sem e-mail recupera pela empresa.
 */
@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly neon: NeonAuthClient,
    private readonly sessionCache: SessionGuardCache,
  ) {}

  /** Envia o código. A resposta é sempre a mesma, exista ou não o e-mail. */
  async requestCode(dto: ForgotPasswordDto, ip?: string) {
    this.assertNotConfigured();
    this.limit(`req-ip:${ip}`, LIMITS.requestPerIp);
    this.limit(`req-email:${dto.email}`, LIMITS.requestPerEmail);

    const account = await this.findAccount(dto.email);
    if (!account || !account.isActive || !account.tenantActive) return { message: GENERIC_SENT };

    const mirror = await this.neon.ensureUser(dto.email, account.name);
    const sent = mirror.ok ? await this.neon.sendResetCode(dto.email) : mirror;
    if (!sent.ok) this.logger.warn(`Neon Auth não enviou o código (${sent.status} ${sent.code}): ${sent.message}`);
    return { message: GENERIC_SENT };
  }

  /** Confere o código no Neon Auth e, se estiver certo, troca a senha no CHECK-ON. */
  async resetWithCode(dto: ResetPasswordWithCodeDto) {
    this.assertNotConfigured();
    this.limit(`try-email:${dto.email}`, LIMITS.attemptPerEmail);

    const account = await this.findAccount(dto.email);
    if (!account) throw new BadRequestException(INVALID_CODE);
    if (!account.isActive || !account.tenantActive) {
      throw new BadRequestException('Este acesso está bloqueado. Procure o administrador da sua empresa.');
    }

    const result = await this.neon.consumeResetCode(dto.email, dto.code);
    if (!result.ok) {
      if (/TOO_MANY/i.test(result.code)) throw new BadRequestException('Muitas tentativas com este código. Peça um novo código.');
      if (!/INVALID_OTP|OTP_EXPIRED|INVALID|EXPIRED/i.test(result.code)) {
        this.logger.warn(`Neon Auth recusou a redefinição (${result.status} ${result.code}): ${result.message}`);
      }
      throw new BadRequestException(INVALID_CODE);
    }

    const now = new Date();
    const hash = await bcrypt.hash(dto.newPassword, 10);
    // SQL direto: rota pública, sem empresa no contexto (o filtro de tenant não se aplica).
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "User" SET "passwordHash" = ${hash}, "mustChangePassword" = false, "passwordChangedAt" = ${now},
          "failedLoginCount" = 0, "lockedUntil" = NULL, "updatedAt" = ${now}
        WHERE id = ${account.id}`,
      this.prisma.$executeRaw`UPDATE "RefreshToken" SET "revokedAt" = ${now} WHERE "userId" = ${account.id} AND "revokedAt" IS NULL`,
    ]);
    this.sessionCache.invalidateUser(account.id);
    this.hits.delete(`try-email:${dto.email}`);
    return { message: 'Senha alterada. Entre com o seu e-mail e a nova senha.' };
  }

  private assertNotConfigured() {
    if (!this.neon.isConfigured()) {
      throw new HttpException(
        'A recuperação de senha por e-mail ainda não está disponível. Peça uma nova senha ao administrador da sua empresa.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async findAccount(email: string): Promise<Account | null> {
    const rows = await this.prisma.$queryRaw<Account[]>`
      SELECT u.id, u.name, u."isActive", t."isActive" AS "tenantActive"
      FROM "User" u JOIN "Tenant" t ON t.id = u."tenantId"
      WHERE lower(u.email) = ${email}
      LIMIT 1`;
    return rows[0] ?? null;
  }

  /** Limite simples em memória (por instância da API), contra abuso de envio de e-mail. */
  private limit(key: string, max: number) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
    if (recent.length >= max) {
      throw new HttpException('Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}
