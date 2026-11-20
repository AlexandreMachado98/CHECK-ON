import { ACTIVE_NC_STATUSES } from '../checklist/checklist-rules';

/** Máximo de fotos por registro de tratativa. */
export const MAX_ACTION_PHOTOS = 3;

export type ResolutionInput = {
  fromStatus: string;
  toStatus?: string | null;
  severity: string;
  /** Texto deste registro (o que foi feito). */
  text?: string | null;
  /** Há foto da tratativa: neste registro ou em registros anteriores da mesma NC. */
  hasTreatmentPhoto: boolean;
};

/**
 * Regras para resolver/encerrar uma NC (sair de "aberta/em tratamento"):
 * - descrever o que foi feito;
 * - NC crítica: ter ao menos uma foto da tratativa (o "depois" da correção).
 * Devolve a mensagem de erro, ou null se pode seguir.
 */
export function resolutionError(input: ResolutionInput): string | null {
  const resolving = !!input.toStatus && ['RESOLVED', 'CLOSED'].includes(input.toStatus) && ACTIVE_NC_STATUSES.includes(input.fromStatus);
  if (!resolving) return null;
  if (!input.text?.trim()) return 'Para resolver a NC, descreva o que foi feito.';
  if (input.severity === 'CRITICAL' && !input.hasTreatmentPhoto) {
    return 'NC crítica: anexe ao menos uma foto da correção para resolver.';
  }
  return null;
}
