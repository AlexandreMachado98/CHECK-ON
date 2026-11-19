import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { corsOrigins, neonAuthUrl } from '../config/env';

/** Resultado de uma chamada ao Neon Auth: ok, ou o código de erro que ele devolveu (ex.: INVALID_OTP). */
export type NeonAuthResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string; /** Segundos para tentar de novo, quando o Neon limita envios. */ retryAfter?: number };

const TIMEOUT_MS = 10_000;

/**
 * Cliente do Neon Auth (Managed Better Auth), chamado pelo servidor da API.
 * O login do CHECK-ON continua sendo o nosso; o Neon Auth só envia o código por e-mail
 * e confirma que ele está certo. Ele exige que o e-mail exista lá: criamos um "espelho"
 * com senha aleatória (nunca a senha real do usuário).
 */
@Injectable()
export class NeonAuthClient {
  private readonly logger = new Logger(NeonAuthClient.name);

  isConfigured(): boolean {
    return !!neonAuthUrl();
  }

  /** Garante que o e-mail existe no Neon Auth. "Já existe" conta como sucesso. */
  async ensureUser(email: string, name: string): Promise<NeonAuthResult> {
    const result = await this.post('/sign-up/email', {
      email,
      name: name || email,
      password: randomBytes(24).toString('base64url'),
    });
    if (!result.ok && /ALREADY_EXISTS|USER_EXISTS/i.test(result.code)) return { ok: true };
    return result;
  }

  /** Neon envia por e-mail o código de redefinição de senha. */
  sendResetCode(email: string): Promise<NeonAuthResult> {
    return this.post('/email-otp/request-password-reset', { email });
  }

  /** Neon envia por e-mail um código para confirmar que o endereço é da pessoa (troca de e-mail). */
  sendEmailVerificationCode(email: string): Promise<NeonAuthResult> {
    return this.post('/email-otp/send-verification-otp', { email, type: 'email-verification' });
  }

  /** Confere e consome o código de confirmação de e-mail. */
  verifyEmailCode(email: string, otp: string): Promise<NeonAuthResult> {
    return this.post('/email-otp/verify-email', { email, otp });
  }

  /**
   * Confere e CONSOME o código (não pode ser reutilizado). A senha gravada no Neon é aleatória:
   * a senha nova do usuário fica só no CHECK-ON.
   */
  consumeResetCode(email: string, otp: string): Promise<NeonAuthResult> {
    return this.post('/email-otp/reset-password', { email, otp, password: randomBytes(24).toString('base64url') });
  }

  /**
   * O Neon Auth exige o cabeçalho Origin, e ele precisa estar nos "Trusted domains" do projeto.
   * Ordem: NEON_AUTH_ORIGIN, o primeiro domínio de CORS_ORIGINS (o painel) e, sem nada, localhost.
   */
  private origin(): string {
    const explicit = process.env.NEON_AUTH_ORIGIN?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const origins = corsOrigins();
    if (Array.isArray(origins) && origins.length) return origins[0];
    return 'http://localhost:3000';
  }

  private async post(path: string, body: Record<string, unknown>): Promise<NeonAuthResult> {
    const base = neonAuthUrl();
    if (!base) throw new ServiceUnavailableException('Recuperação de senha por e-mail não está configurada.');
    const origin = this.origin();
    try {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) return { ok: true };
      const data = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      const retry = Number(response.headers.get('retry-after') ?? response.headers.get('x-retry-after'));
      return {
        ok: false,
        status: response.status,
        code: data.code ?? (response.status === 429 ? 'TOO_MANY_REQUESTS' : `HTTP_${response.status}`),
        message: data.message ?? '',
        retryAfter: Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : undefined,
      };
    } catch (error) {
      this.logger.error(`Neon Auth indisponível em ${path}`, error as Error);
      throw new ServiceUnavailableException('O serviço de recuperação de senha não respondeu. Tente de novo em instantes.');
    }
  }
}
