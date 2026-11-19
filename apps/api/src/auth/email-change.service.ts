import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NeonAuthClient } from './neon-auth.client';
import { ConfirmEmailChangeDto, RequestEmailChangeDto } from './dto/change-email.dto';

/** O código de confirmação vale por este tempo depois do pedido. */
const PENDING_TTL_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 3;

type Row = { id: string; name: string; email: string | null; passwordHash: string; pendingEmail: string | null; pendingEmailRequestedAt: Date | null };

/**
 * A pessoa troca o próprio e-mail de acesso (inclusive o super admin). Exige a senha atual e,
 * com o Neon Auth configurado, um código enviado ao NOVO e-mail: a recuperação de senha
 * sempre vai para uma caixa que a pessoa abre.
 */
@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly neon: NeonAuthClient,
  ) {}

  async request(userId: string, dto: RequestEmailChangeDto) {
    // Contam no limite só senha errada e código enviado: falha de configuração não gasta tentativa.
    this.assertUnderLimit(userId);
    const user = await this.load(userId);
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      this.record(userId);
      throw new BadRequestException('A senha atual não confere.');
    }
    if (user.email && user.email.toLowerCase() === dto.newEmail) {
      throw new BadRequestException('Este já é o seu e-mail de acesso.');
    }
    await this.assertEmailFree(dto.newEmail, userId);

    // Sem Neon Auth: troca direto (a senha atual já foi conferida).
    if (!this.neon.isConfigured()) {
      const updated = await this.apply(userId, dto.newEmail);
      return { requiresCode: false, email: updated };
    }

    const mirror = await this.neon.ensureUser(dto.newEmail, user.name);
    const sent = mirror.ok ? await this.neon.sendEmailVerificationCode(dto.newEmail) : mirror;
    if (!sent.ok) {
      this.logger.warn(`Neon Auth não enviou o código de troca de e-mail (${sent.status} ${sent.code}): ${sent.message}`);
      // Limite de envios do Neon: diz quanto esperar, em vez de uma mensagem genérica.
      if (sent.status === 429 || /TOO_MANY|RATE/i.test(sent.code)) {
        const wait = sent.retryAfter ? `${sent.retryAfter} segundos` : '1 minuto';
        throw new HttpException(`O serviço de e-mail limitou os envios seguidos. Aguarde ${wait} e clique de novo, uma vez só.`, HttpStatus.TOO_MANY_REQUESTS);
      }
      // O código do erro ajuda o suporte a identificar a causa sem acesso aos logs.
      throw new HttpException(`Não foi possível enviar o código para o novo e-mail (motivo: ${sent.code}). Tente de novo em instantes.`, HttpStatus.BAD_GATEWAY);
    }
    this.record(userId);
    await this.prisma.$executeRaw`
      UPDATE "User" SET "pendingEmail" = ${dto.newEmail}, "pendingEmailRequestedAt" = ${new Date()} WHERE id = ${userId}`;
    return { requiresCode: true, message: `Enviamos um código para ${dto.newEmail}. Confira também a caixa de spam.` };
  }

  async confirm(userId: string, dto: ConfirmEmailChangeDto) {
    const user = await this.load(userId);
    const expired = !user.pendingEmailRequestedAt || Date.now() - user.pendingEmailRequestedAt.getTime() > PENDING_TTL_MS;
    if (!user.pendingEmail || user.pendingEmail !== dto.newEmail || expired) {
      throw new BadRequestException('Pedido de troca de e-mail expirado. Comece de novo.');
    }
    const result = await this.neon.verifyEmailCode(dto.newEmail, dto.code);
    if (!result.ok) {
      if (/TOO_MANY/i.test(result.code)) throw new BadRequestException('Muitas tentativas com este código. Comece de novo.');
      throw new BadRequestException('Código inválido ou expirado.');
    }
    await this.assertEmailFree(dto.newEmail, userId);
    return { email: await this.apply(userId, dto.newEmail) };
  }

  private async apply(userId: string, email: string): Promise<string> {
    await this.prisma.$executeRaw`
      UPDATE "User" SET email = ${email}, "pendingEmail" = NULL, "pendingEmailRequestedAt" = NULL, "updatedAt" = ${new Date()}
      WHERE id = ${userId}`;
    this.hits.delete(userId);
    return email;
  }

  // SQL direto: o usuário é o do token (inclui o super admin, cuja empresa é a da plataforma).
  private async load(userId: string): Promise<Row> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT id, name, email, "passwordHash", "pendingEmail", "pendingEmailRequestedAt" FROM "User" WHERE id = ${userId}`;
    if (!rows[0]) throw new NotFoundException('Usuário não encontrado.');
    return rows[0];
  }

  private async assertEmailFree(email: string, userId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE lower(email) = ${email} AND id <> ${userId} LIMIT 1`;
    if (rows.length) throw new ConflictException('Este e-mail já é usado por outro acesso.');
  }

  private recent(key: string): number[] {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
    this.hits.set(key, list);
    return list;
  }

  private assertUnderLimit(key: string) {
    const list = this.recent(key);
    if (list.length >= MAX_REQUESTS) {
      const minutes = Math.max(1, Math.ceil((list[0] + WINDOW_MS - Date.now()) / 60000));
      throw new HttpException(
        `Muitos pedidos seguidos. Aguarde ${minutes} minuto${minutes === 1 ? '' : 's'} e tente de novo.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private record(key: string) {
    this.recent(key).push(Date.now());
  }
}
