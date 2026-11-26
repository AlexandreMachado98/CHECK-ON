/** Pontos que o passageiro pode marcar na avaliação, com o texto mostrado na página e no portal. */
export const DRIVING_TAGS = {
  VELOCIDADE: 'Excesso de velocidade',
  FREADAS: 'Freadas ou curvas bruscas',
  CELULAR: 'Celular ao volante',
  CORTESIA: 'Falta de cortesia',
  PONTUALIDADE: 'Atraso',
  LIMPEZA: 'Veículo sujo',
} as const;
export type DrivingTag = keyof typeof DRIVING_TAGS;
export const DRIVING_TAG_KEYS = Object.keys(DRIVING_TAGS) as DrivingTag[];

export const FEEDBACK_STATUSES = ['NOVA', 'EM_ANALISE', 'TRATADA'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Uma avaliação do mesmo aparelho para o mesmo motorista (ou veículo) a cada tantas horas. */
export const REPEAT_WINDOW_HOURS = 6;

/** Nota 1 ou 2, ou celular ao volante: vira alerta para o gestor tratar. */
export function isAlert(rating: number, tags: string[]): boolean {
  return rating <= 2 || tags.includes('CELULAR');
}

/** Nome curto para a página pública ("Carlos Eduardo de Souza" → "Carlos S."): o passageiro reconhece sem expor o nome todo. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  const connectors = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  const last = [...parts.slice(1)].reverse().find((p) => !connectors.has(p.toLowerCase())) ?? parts[parts.length - 1];
  // Nome com número no fim ("Motorista 136"): a inicial não diz nada, mostra o número inteiro.
  if (/^\d/.test(last)) return `${parts[0]} ${last}`;
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

/** Código do QR do passageiro: 24 bytes em base64url (32 caracteres). */
export const PASSENGER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
