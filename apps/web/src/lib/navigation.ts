/**
 * Troca de sessão (entrar, sair, sessão expirada, entrar/voltar de uma empresa): recarrega a página
 * inteira em vez de navegar pelo roteador, para não sobrar na memória nada da sessão anterior
 * (telas, listas e respostas guardadas). Também serve fora de componentes React (ex.: lib/api).
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
