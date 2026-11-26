export type FeedbackStatus = 'NOVA' | 'EM_ANALISE' | 'TRATADA';

export interface DrivingFeedbackItem {
  id: string;
  rating: number;
  tags: string[];
  comment: string | null;
  contact: string | null;
  alert: boolean;
  status: FeedbackStatus;
  treatment: string | null;
  treatedAt: string | null;
  treatedByName: string | null;
  createdAt: string;
  vehicle: { id: string; plate: string; prefix: string | null; model: string | null };
  driver: { id: string; name: string; matricula: string | null } | null;
  checklist: { id: string; completedAt: string | null } | null;
}

export interface DriverRanking {
  driverId: string | null;
  name: string;
  matricula: string | null;
  count: number;
  average: number;
  openAlerts: number;
  lastAt: string | null;
}

export interface DrivingOverview {
  days: number;
  summary: { count: number; average: number; openAlerts: number };
  drivers: DriverRanking[];
  items: DrivingFeedbackItem[];
  tags: Record<string, string>;
  tagGroups?: TagGroups;
}

export const FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; badge: string }> = {
  NOVA: { label: 'Nova', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  EM_ANALISE: { label: 'Em análise', badge: 'bg-amber-50 text-amber-900 border-amber-200' },
  TRATADA: { label: 'Tratada', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

/** Grupos de pontos que o passageiro marca (iguais aos da API). */
export interface TagGroups { positive: string[]; attention: string[] }

/** Pontos que se contradizem (igual a OPPOSITE_TAGS da API): marcar um desmarca o outro. */
export const OPPOSITE_TAGS: [string, string][] = [
  ['DIRECAO_SEGURA', 'VELOCIDADE'],
  ['DIRECAO_SEGURA', 'FREADAS'],
  ['DIRECAO_SEGURA', 'CELULAR'],
  ['EDUCADO', 'CORTESIA'],
  ['PONTUAL', 'PONTUALIDADE'],
  ['VEICULO_LIMPO', 'LIMPEZA'],
  ['TRANQUILA', 'FREADAS'],
];

/** Marca ou desmarca um ponto; ao marcar, tira os que o contradizem. */
export function toggleTag(tags: string[], key: string): string[] {
  if (tags.includes(key)) return tags.filter((t) => t !== key);
  const opposites = OPPOSITE_TAGS.flatMap(([a, b]) => (a === key ? [b] : b === key ? [a] : []));
  return [...tags.filter((t) => !opposites.includes(t)), key];
}
