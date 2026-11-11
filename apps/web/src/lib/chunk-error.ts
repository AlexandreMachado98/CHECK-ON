/**
 * Depois de um novo deploy, uma aba aberta antes dele ainda aponta para os arquivos JS da versão
 * anterior. Ao navegar, o navegador pede esses arquivos, a Vercel responde 404 e o Next.js mostra
 * "Application error: a client-side exception has occurred".
 * A solução é recarregar a página uma vez, para buscar a versão nova.
 */
const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

const RELOAD_KEY = 'checkon:chunk-reload-at';
/** Evita recarregar em loop se o erro continuar depois do reload. */
const RELOAD_COOLDOWN_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as { name?: string }).name ?? '';
  const message = (error as { message?: string }).message ?? String(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(name) || pattern.test(message));
}

/** Recarrega a página uma vez. Devolve false se já recarregou há pouco (o erro é outro). */
export function reloadOnceForNewVersion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage bloqueado (modo privado restrito): recarrega mesmo assim, uma vez por erro.
  }
  window.location.reload();
  return true;
}
