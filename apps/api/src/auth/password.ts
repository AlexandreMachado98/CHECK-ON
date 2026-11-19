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
 * Limite por endereço de IP (em memória, por instância da API): protege contra quem testa
 * muitas contas a partir do mesmo lugar. O bloqueio por conta fica no banco e vale em todas as instâncias.
 */
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_FAILURES = 30;
const ipFailures = new Map<string, { count: number; since: number }>();

export function ipIsBlocked(ip?: string): boolean {
  if (!ip) return false;
  const entry = ipFailures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.since > IP_WINDOW_MS) {
    ipFailures.delete(ip);
    return false;
  }
  return entry.count >= IP_MAX_FAILURES;
}

export function registerIpFailure(ip?: string) {
  if (!ip) return;
  const entry = ipFailures.get(ip);
  if (!entry || Date.now() - entry.since > IP_WINDOW_MS) ipFailures.set(ip, { count: 1, since: Date.now() });
  else entry.count++;
}
