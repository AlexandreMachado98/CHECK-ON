import { randomInt } from 'crypto';

/** Sem caracteres que se confundem ao ditar ou digitar (0/O, 1/l/I). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Senha provisória de 10 caracteres, para a empresa entregar ao colaborador. */
export function generateTemporaryPassword(length = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) password += ALPHABET[randomInt(ALPHABET.length)];
  return password;
}

/** Tentativas seguidas erradas antes de bloquear o login, e por quanto tempo. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/**
 * Limite por endereço de IP: protege contra quem testa muitas contas (ou matrículas) a partir do
 * mesmo lugar. Fica no banco (RateLimit), valendo para todas as instâncias da API.
 * O bloqueio por conta (senha errada) fica no próprio usuário.
 */
export const IP_WINDOW_MS = 15 * 60 * 1000;
export const IP_MAX_FAILURES = 30;
