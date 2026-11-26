import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Pontos positivos que o passageiro pode marcar (texto mostrado na página e no portal). */
export const POSITIVE_TAGS = {
  DIRECAO_SEGURA: 'Direção segura',
  EDUCADO: 'Motorista educado',
  PONTUAL: 'Pontual',
  TRANQUILA: 'Viagem tranquila',
  VEICULO_LIMPO: 'Veículo limpo',
} as const;

/** Pontos de atenção (negativos). */
export const ATTENTION_TAGS = {
  VELOCIDADE: 'Excesso de velocidade',
  FREADAS: 'Freadas ou curvas bruscas',
  CELULAR: 'Celular ao volante',
  CORTESIA: 'Falta de cortesia',
  PONTUALIDADE: 'Atraso',
  LIMPEZA: 'Veículo sujo',
} as const;

/** Todos os pontos, com o texto (o portal mostra qualquer um que esteja gravado). */
export const DRIVING_TAGS = { ...POSITIVE_TAGS, ...ATTENTION_TAGS } as const;
export type DrivingTag = keyof typeof DRIVING_TAGS;
export const DRIVING_TAG_KEYS = Object.keys(DRIVING_TAGS) as DrivingTag[];
export const TAG_GROUPS = { positive: Object.keys(POSITIVE_TAGS), attention: Object.keys(ATTENTION_TAGS) };

/** Pontos que se contradizem: marcar um desmarca o outro na página, e a API recusa os dois juntos. */
export const OPPOSITE_TAGS: [DrivingTag, DrivingTag][] = [
  ['DIRECAO_SEGURA', 'VELOCIDADE'],
  ['DIRECAO_SEGURA', 'FREADAS'],
  ['DIRECAO_SEGURA', 'CELULAR'],
  ['EDUCADO', 'CORTESIA'],
  ['PONTUAL', 'PONTUALIDADE'],
  ['VEICULO_LIMPO', 'LIMPEZA'],
  ['TRANQUILA', 'FREADAS'],
];

/** Primeiro par contraditório marcado (ou null). */
export function contradiction(tags: string[]): [string, string] | null {
  const pair = OPPOSITE_TAGS.find(([a, b]) => tags.includes(a) && tags.includes(b));
  return pair ? [DRIVING_TAGS[pair[0]], DRIVING_TAGS[pair[1]]] : null;
}

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

/**
 * Veículo do QR do passageiro (página pública, sem login): a empresa e a frente vêm do cadastro da
 * placa (frota do veículo). Veículo inativo, empresa desativada ou código trocado: 404.
 */
export async function findPassengerVehicle(prisma: PrismaService, token: string) {
  if (!PASSENGER_TOKEN_PATTERN.test(token)) throw new NotFoundException('Este QR Code não é válido ou foi trocado.');
  const vehicle = await prisma.vehicle.findFirst({
    where: { passengerToken: token, isActive: true, tenant: { isActive: true } },
    select: {
      id: true,
      tenantId: true,
      plate: true,
      prefix: true,
      model: true,
      status: true,
      emExpiresAt: true,
      emReleasedUntil: true,
      fleet: { select: { unitId: true } },
      tenant: { select: { name: true } },
    },
  });
  if (!vehicle) throw new NotFoundException('Este QR Code não é válido ou foi trocado.');
  return vehicle;
}
