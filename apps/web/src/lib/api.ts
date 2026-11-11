import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

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
  if (!isRetryable(error)) throw error;
  const config = error.config as RetryableConfig;
  config.__retryCount = (config.__retryCount ?? 0) + 1;
  const delay = RETRY_BASE_DELAY_MS * 2 ** (config.__retryCount - 1);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return api.request(config);
});

export default api;
