import { randomBytes } from 'node:crypto';

export const SUGGESTION_CATEGORIES = {
  CONFORTO: 'Conforto',
  HORARIO: 'Horário',
  ROTA: 'Rota ou itinerário',
  SEGURANCA: 'Segurança',
  LIMPEZA: 'Limpeza',
  OUTRO: 'Outro assunto',
} as const;
export const CATEGORY_KEYS = Object.keys(SUGGESTION_CATEGORIES);

export const SUGGESTION_STATUSES = ['RECEBIDA', 'PRIORIZADA', 'EM_ANDAMENTO', 'RESOLVIDA', 'ARQUIVADA'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export const PRIORITIES = ['ALTA', 'MEDIA', 'BAIXA'] as const;
export const ACTIONS = ['PRIORIZAR', 'INICIAR', 'RESOLVER', 'ARQUIVAR', 'REABRIR'] as const;
export type SuggestionAction = (typeof ACTIONS)[number];

/** De onde cada ação pode partir. Resolver exige priorizar antes: só priorizadas contam na nota. */
export const ALLOWED_FROM: Record<SuggestionAction, SuggestionStatus[]> = {
  PRIORIZAR: ['RECEBIDA', 'PRIORIZADA', 'EM_ANDAMENTO'],
  INICIAR: ['PRIORIZADA'],
  RESOLVER: ['PRIORIZADA', 'EM_ANDAMENTO'],
  ARQUIVAR: ['RECEBIDA', 'PRIORIZADA', 'EM_ANDAMENTO'],
  REABRIR: ['ARQUIVADA'],
};

const PROTOCOL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "SG-7K3M9Q": sem letras e números que se confundem (O/0, I/1, L). */
export function newProtocol(): string {
  const bytes = randomBytes(6);
  return `SG-${[...bytes].map((b) => PROTOCOL_ALPHABET[b % PROTOCOL_ALPHABET.length]).join('')}`;
}

export const FOLLOW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export type ScoreInput = { status: string; prioritizedAt: Date | null; dueDate: Date | null; resolvedAt: Date | null; rating: number | null };

/**
 * Nota da empresa nas sugestões: conta só as priorizadas pelo gestor (as arquivadas ficam de fora).
 * A nota é a média das avaliações dos passageiros às tratativas resolvidas; junto vão quantas foram
 * priorizadas, resolvidas e resolvidas no prazo.
 */
export function suggestionScore(items: ScoreInput[]) {
  const prioritized = items.filter((s) => s.prioritizedAt && s.status !== 'ARQUIVADA');
  const resolved = prioritized.filter((s) => s.status === 'RESOLVIDA');
  const withDue = resolved.filter((s) => s.dueDate && s.resolvedAt);
  // Prazo é uma data: resolvida até o fim do dia do prazo está no prazo.
  const onTime = withDue.filter((s) => s.resolvedAt!.getTime() < s.dueDate!.getTime() + 24 * 60 * 60 * 1000).length;
  const rated = resolved.filter((s) => s.rating !== null);
  const average = rated.length ? Math.round((rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
  return {
    prioritized: prioritized.length,
    resolved: resolved.length,
    open: prioritized.length - resolved.length,
    withDue: withDue.length,
    onTime,
    rated: rated.length,
    average,
  };
}
