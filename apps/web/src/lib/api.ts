import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearSession, isImpersonating, returnToPlatform, setLoginNotice } from './session';

/**
 * Endereço base da API.
 * - Vercel (services) e `vercel dev`: a API é servida na mesma origem em /api, então o padrão é '/api'.
 * - `next dev` isolado, ou API hospedada em outro domínio: defina NEXT_PUBLIC_API_URL
 *   (ex.: http://localhost:3333 ou https://checkon-api.onrender.com), sem barra no final.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  // A primeira chamada depois de um tempo parada sobe a função da API e reconecta o banco:
  // 6 s não bastavam e viravam erro na tela.
  timeout: 15000,
});

/** Leituras que falham por instabilidade passageira são repetidas, com espera crescente. */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

type RetryableConfig = InternalAxiosRequestConfig & { __retryCount?: number };

function isRetryable(error: AxiosError): boolean {
  const config = error.config as RetryableConfig | undefined;
  if (!config) return false;
  // Gravações (POST/PATCH/DELETE) não são repetidas: poderiam executar duas vezes.
  if (!RETRYABLE_METHODS.has((config.method ?? 'get').toLowerCase())) return false;
  if ((config.__retryCount ?? 0) >= MAX_RETRIES) return false;
  if (!error.response) return error.code !== AxiosError.ERR_CANCELED; // rede ou timeout
  return RETRYABLE_STATUSES.has(error.response.status);
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  // O acesso do super admin a uma empresa vale 1 hora: ao expirar, volta sozinho para a plataforma.
  if (error.response?.status === 401 && typeof window !== 'undefined' && isImpersonating()) {
    if (returnToPlatform()) {
      window.location.assign('/dashboard/tenants?acesso=expirado');
      return new Promise(() => {}); // a página vai recarregar; não mostra erro na tela
    }
  }
  // Login expirado (1 dia), usuário bloqueado ou sessões revogadas: volta para o login explicando o motivo,
  // em vez de deixar o painel aberto com telas vazias. A própria tentativa de login não entra aqui.
  if (error.response?.status === 401 && typeof window !== 'undefined' && !error.config?.url?.includes('/auth/login')) {
    const apiMessage = (error.response.data as { message?: unknown } | undefined)?.message;
    const reason = typeof apiMessage === 'string' && apiMessage !== 'Unauthorized' ? apiMessage : 'Sua sessão expirou. Entre novamente para continuar.';
    clearSession();
    setLoginNotice(reason);
    if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    return new Promise(() => {}); // a página vai para o login; não mostra erro na tela
  }
  if (!isRetryable(error)) throw error;
  const config = error.config as RetryableConfig;
  config.__retryCount = (config.__retryCount ?? 0) + 1;
  const delay = RETRY_BASE_DELAY_MS * 2 ** (config.__retryCount - 1);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return api.request(config);
});

export default api;

/**
 * Garante que a resposta é uma lista antes de a tela usar .filter/.map.
 * Se vier outra coisa (página HTML de erro, objeto), lança um erro claro em vez de quebrar a tela inteira.
 */
export function ensureList<T>(data: unknown, what: string): T[] {
  if (Array.isArray(data)) return data as T[];
  const kind = typeof data === 'string' ? `texto (${data.trim().slice(0, 40)}...)` : data === null ? 'vazio' : typeof data;
  console.error(`Resposta inesperada da API ao carregar ${what}:`, data);
  throw new Error(`A API devolveu ${kind} em vez da lista de ${what}.`);
}
