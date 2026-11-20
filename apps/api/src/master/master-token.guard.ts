import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';

/** Tentativas com chave errada (por IP) antes de bloquear por 15 minutos. */
const MAX_FAILURES = 10;
const BLOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; until: number }>();

/** Chave combinada com o DDS Master (variável CHECKON_MASTER_TOKEN, 32 caracteres ou mais). */
export function masterToken(): string | null {
  const token = (process.env.CHECKON_MASTER_TOKEN ?? '').trim();
  return token.length >= 32 ? token : null;
}

function sameSecret(a: string, b: string): boolean {
  // Compara os resumos (mesmo tamanho), em tempo constante.
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/**
 * Integração servidor-a-servidor com o DDS Master: "Authorization: Bearer <CHECKON_MASTER_TOKEN>".
 * Sem a variável configurada, a integração fica desligada (503). Nunca usa o login de usuários do CHECK-ON.
 */
@Injectable()
export class MasterTokenGuard implements CanActivate {
  private readonly logger = new Logger('MasterApi');

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = masterToken();
    if (!expected) throw new ServiceUnavailableException('A integração com o DDS Master não está configurada (CHECKON_MASTER_TOKEN).');

    const ip = clientIp(request) ?? 'desconhecido';
    const now = Date.now();
    const record = failures.get(ip);
    if (record && record.until > now) {
      throw new HttpException('Muitas tentativas com chave inválida. Aguarde 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const header = request.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token && sameSecret(token, expected)) {
      failures.delete(ip);
      return true;
    }

    const count = (record && record.until <= now && record.count >= MAX_FAILURES ? 0 : record?.count ?? 0) + 1;
    failures.set(ip, { count, until: count >= MAX_FAILURES ? now + BLOCK_MS : 0 });
    this.logger.warn(`Chave do DDS Master inválida (IP ${ip}, tentativa ${count}).`);
    throw new UnauthorizedException('Chave de integração inválida.');
  }
}

/** Só para testes. */
export function resetMasterGuardFailures() {
  failures.clear();
}
