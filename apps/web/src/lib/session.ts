import type { AuthUser } from './types';

/**
 * Sessão do painel no navegador.
 * "Acessar empresa": a sessão do super admin fica guardada à parte e volta ao clicar em
 * "Voltar à plataforma", ou sozinha quando o acesso de 1 hora expira.
 */
const TOKEN = 'token';
const USER = 'user';
const PLATFORM_TOKEN = 'platform_token';
const PLATFORM_USER = 'platform_user';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  const raw = storage()?.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isImpersonating(): boolean {
  return !!storage()?.getItem(PLATFORM_TOKEN);
}

/** Entra na empresa: guarda a sessão do super admin e passa a usar a da empresa. */
export function startTenantAccess(accessToken: string, tenantUser: AuthUser) {
  const s = storage();
  if (!s) return;
  // Se já estiver dentro de uma empresa, mantém a sessão original da plataforma.
  if (!s.getItem(PLATFORM_TOKEN)) {
    s.setItem(PLATFORM_TOKEN, s.getItem(TOKEN) ?? '');
    s.setItem(PLATFORM_USER, s.getItem(USER) ?? '');
  }
  s.setItem(TOKEN, accessToken);
  s.setItem(USER, JSON.stringify({ ...tenantUser, impersonating: true }));
}

/** Volta para a sessão do super admin. Devolve false se não havia sessão guardada. */
export function returnToPlatform(): boolean {
  const s = storage();
  const token = s?.getItem(PLATFORM_TOKEN);
  const user = s?.getItem(PLATFORM_USER);
  if (!s || !token || !user) return false;
  s.setItem(TOKEN, token);
  s.setItem(USER, user);
  s.removeItem(PLATFORM_TOKEN);
  s.removeItem(PLATFORM_USER);
  return true;
}

const LOGIN_NOTICE = 'login_notice';

/** Mensagem para a tela de login (ex.: "sua sessão expirou"), lida uma única vez. */
export function setLoginNotice(message: string) {
  try {
    window.sessionStorage.setItem(LOGIN_NOTICE, message);
  } catch {
    // sem sessionStorage: a tela de login abre sem o aviso
  }
}

export function takeLoginNotice(): string {
  try {
    const message = window.sessionStorage.getItem(LOGIN_NOTICE) ?? '';
    window.sessionStorage.removeItem(LOGIN_NOTICE);
    return message;
  } catch {
    return '';
  }
}

/** Sai de tudo, inclusive da sessão guardada da plataforma. */
export function clearSession() {
  const s = storage();
  [TOKEN, USER, PLATFORM_TOKEN, PLATFORM_USER].forEach((key) => s?.removeItem(key));
}
