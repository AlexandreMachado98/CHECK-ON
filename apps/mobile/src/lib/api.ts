import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';
import { deviceInfo } from './device';
import { messageFromBody } from './rules';
import type { Session, SessionUser } from './types';

const SESSION_KEY = 'checkon.session';
const TIMEOUT_MS = 25_000;

/** Erro de chamada à API. `offline` = não chegou ao servidor (sem internet, servidor fora, tempo esgotado). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly offline = false,
  ) {
    super(message);
  }
}

/** A sessão terminou (acesso bloqueado, empresa inativa, sessão expirada): é preciso entrar de novo. */
export class SessionEndedError extends ApiError {}

let session: Session | null = null;
const listeners = new Set<(s: Session | null) => void>();

export function currentSession(): Session | null {
  return session;
}

export function onSessionChange(listener: (s: Session | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function saveSession(next: Session | null) {
  session = next;
  if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
  listeners.forEach((listener) => listener(next));
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }
  return session;
}

type TokenResponse = { access_token: string; refresh_token: string; user: SessionUser };

function toSession(data: TokenResponse): Session {
  const u = data.user;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: { id: u.id, name: u.name, tenantId: u.tenantId, tenantName: u.tenantName, tenantCode: u.tenantCode, role: u.role },
  };
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError('Sem conexão com o servidor. Confira a internet e tente de novo.', 0, undefined, true);
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFrom(res: Response, body: unknown): ApiError {
  const code = body && typeof body === 'object' && 'code' in body ? String((body as { code: unknown }).code) : undefined;
  if (res.status >= 500) {
    // Servidor com problema: trata como "sem conexão" para a inspeção ficar na fila e ser reenviada.
    return new ApiError('O servidor está com instabilidade. Tente de novo em instantes.', res.status, code, true);
  }
  return new ApiError(messageFromBody(body, `Erro ${res.status}.`), res.status, code);
}

/** Login do aplicativo: código da empresa + matrícula. */
export async function appLogin(companyCode: string, matricula: string): Promise<Session> {
  const res = await rawFetch('/auth/app-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ companyCode, matricula }),
  });
  const body = await readBody(res);
  if (res.status === 429) throw new ApiError(messageFromBody(body, 'Muitas tentativas. Aguarde alguns minutos.'), 429);
  if (!res.ok) throw errorFrom(res, body);
  const next = toSession(body as TokenResponse);
  await saveSession(next);
  return next;
}

/** Sai do aplicativo. Os dados guardados no aparelho (fila de envio) continuam lá. */
export async function logout(): Promise<void> {
  const current = session;
  await saveSession(null);
  if (!current) return;
  // Avisar o servidor é melhor esforço: sem internet, o token só expira sozinho.
  rawFetch('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.accessToken}` },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  }).catch(() => undefined);
}

let refreshing: Promise<void> | null = null;

/**
 * Renova o token. Uma renovação por vez: o servidor invalida a sessão inteira
 * se o mesmo refresh token for usado duas vezes.
 */
function refreshSession(): Promise<void> {
  if (!refreshing) {
    refreshing = (async () => {
      const current = session;
      if (!current) throw new SessionEndedError('Entre de novo no aplicativo.', 401);
      const res = await rawFetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const body = await readBody(res);
      if (res.status === 401 || res.status === 403) {
        await saveSession(null);
        throw new SessionEndedError(messageFromBody(body, 'Sua sessão terminou. Entre de novo.'), res.status);
      }
      if (!res.ok) throw errorFrom(res, body);
      await saveSession(toSession(body as TokenResponse));
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

type RequestOptions = { method?: string; body?: unknown; form?: FormData };

/** Chamada autenticada. Renova o token sozinho quando ele vence. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async () => {
    const current = session;
    if (!current) throw new SessionEndedError('Entre no aplicativo.', 401);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${current.accessToken}`,
      'X-Device-Info': deviceInfo(),
    };
    let body: BodyInit | undefined;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    return rawFetch(path, { method: options.method ?? 'GET', headers, body });
  };

  let res = await send();
  if (res.status === 401) {
    await refreshSession();
    res = await send();
  }
  const body = await readBody(res);
  if (res.status === 401) {
    await saveSession(null);
    throw new SessionEndedError(messageFromBody(body, 'Sua sessão terminou. Entre de novo.'), 401);
  }
  if (!res.ok) throw errorFrom(res, body);
  return body as T;
}
