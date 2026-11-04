// Regras de negócio puras (sem dependências) da execução de checklists.
// Mantidas isoladas para serem testáveis sem banco nem NestJS.

export interface RuleItem {
  id: string;
  text: string;
  type: string; // PASS_FAIL, TEXT, NUMBER, PHOTO
  isRequired: boolean;
  isCritical: boolean;
  /** NONE (padrão), ON_NON_COMPLIANCE ou ALWAYS. Não se aplica a itens do tipo PHOTO. */
  photoRequirement?: string;
}

export const PHOTO_REQUIREMENTS = ['NONE', 'ON_NON_COMPLIANCE', 'ALWAYS'];

export interface VersionedItem extends RuleItem {
  isActive: boolean;
  addedInVersion: number;
}

/**
 * Ajusta os itens do modelo à versão que o app usou (o checklist pode ter sido feito offline,
 * antes de uma edição). Itens removidos depois ou incluídos depois deixam de ser obrigatórios;
 * respostas a itens removidos continuam aceitas, para não perder o que o motorista registrou.
 */
export function itemsForVersion<T extends VersionedItem>(items: T[], version: number): T[] {
  return items.map((item) =>
    item.isActive && item.addedInVersion <= version ? item : { ...item, isRequired: false },
  );
}

/** Diz se a resposta precisa vir com foto, conforme a configuração do item. */
export function photoIsRequired(item: RuleItem, isCompliant: boolean): boolean {
  if (item.type === 'PHOTO') return false; // tratado por isRequired
  if (item.photoRequirement === 'ALWAYS') return true;
  return item.photoRequirement === 'ON_NON_COMPLIANCE' && !isCompliant;
}

export interface RawAnswer {
  itemId: string;
  isCompliant?: boolean;
  textValue?: string;
  numberValue?: number;
  photoUrl?: string;
  observations?: string;
}

export interface NormalizedAnswer {
  itemId: string;
  isCompliant: boolean;
  textValue: string | null;
  numberValue: number | null;
  photoUrl: string | null;
  observations: string | null;
}

export const ACTIVE_NC_STATUSES = ['OPEN', 'IN_PROGRESS'];
export const NC_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const SEVERITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const VEHICLE_STATUS_RANK: Record<string, number> = { LIBERADO: 0, ATENCAO: 1, BLOQUEADO: 2 };

// Tolerância para relógio adiantado do celular.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function clean(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasValue(item: RuleItem, answer: RawAnswer): boolean {
  switch (item.type) {
    case 'TEXT':
      return clean(answer.textValue) !== null;
    case 'NUMBER':
      return typeof answer.numberValue === 'number' && Number.isFinite(answer.numberValue);
    case 'PHOTO':
      return clean(answer.photoUrl) !== null;
    case 'PASS_FAIL':
    default:
      return typeof answer.isCompliant === 'boolean';
  }
}

/**
 * Confere as respostas contra os itens do template e devolve as respostas
 * normalizadas. Qualquer erro impede a gravação da execução inteira.
 */
export function validateAnswers(
  items: RuleItem[],
  answers: RawAnswer[],
): { errors: string[]; answers: NormalizedAnswer[] } {
  const errors: string[] = [];
  const normalized: NormalizedAnswer[] = [];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();

  for (const answer of answers) {
    const item = itemsById.get(answer.itemId);
    if (!item) {
      errors.push(`O item ${answer.itemId} não pertence a este template.`);
      continue;
    }
    if (seen.has(item.id)) {
      errors.push(`O item "${item.text}" foi respondido mais de uma vez.`);
      continue;
    }
    seen.add(item.id);

    const answered = hasValue(item, answer);
    if (!answered) {
      if (item.isRequired) {
        errors.push(`O item obrigatório "${item.text}" está sem resposta válida.`);
        continue;
      }
      // Item opcional vazio só é guardado se foi marcado como não conforme.
      if (answer.isCompliant !== false) continue;
    }

    const isCompliant = item.type === 'PASS_FAIL' ? answer.isCompliant === true : answer.isCompliant !== false;
    if (photoIsRequired(item, isCompliant) && clean(answer.photoUrl) === null) {
      errors.push(
        item.photoRequirement === 'ALWAYS'
          ? `O item "${item.text}" exige foto.`
          : `O item "${item.text}" foi apontado como não conforme e exige foto do problema.`,
      );
      continue;
    }

    normalized.push({
      itemId: item.id,
      isCompliant,
      textValue: clean(answer.textValue),
      numberValue:
        typeof answer.numberValue === 'number' && Number.isFinite(answer.numberValue) ? answer.numberValue : null,
      photoUrl: clean(answer.photoUrl),
      observations: clean(answer.observations),
    });
  }

  for (const item of items) {
    if (item.isRequired && !seen.has(item.id)) {
      errors.push(`O item obrigatório "${item.text}" não foi respondido.`);
    }
  }

  return { errors, answers: normalized };
}

export function validateTimestamps(startedAt: Date, completedAt: Date, now: Date = new Date()): string[] {
  const errors: string[] = [];
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(completedAt.getTime())) {
    errors.push('Datas de início ou conclusão inválidas.');
    return errors;
  }
  if (completedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    errors.push('A data de conclusão está no futuro. Verifique o relógio do aparelho.');
  }
  if (startedAt.getTime() > completedAt.getTime()) {
    errors.push('A data de início é posterior à data de conclusão.');
  }
  return errors;
}

export function severityFor(item: Pick<RuleItem, 'isCritical'>): string {
  return item.isCritical ? 'CRITICAL' : 'MEDIUM';
}

export function maxSeverity(a: string, b: string): string {
  return (SEVERITY_RANK[b] ?? 0) > (SEVERITY_RANK[a] ?? 0) ? b : a;
}

/** Status que o veículo deveria ter considerando apenas as NCs ativas. */
export function vehicleStatusFromActiveNcs(severities: string[]): string {
  if (severities.some((s) => s === 'CRITICAL')) return 'BLOQUEADO';
  if (severities.length > 0) return 'ATENCAO';
  return 'LIBERADO';
}

/** Na chegada de um checklist o status só piora; nunca libera um bloqueio manual. */
export function escalateVehicleStatus(current: string, computed: string): string {
  return (VEHICLE_STATUS_RANK[computed] ?? 0) > (VEHICLE_STATUS_RANK[current] ?? 0) ? computed : current;
}

/** NC encerrada (CLOSED) não pode ser reaberta, nem por sync atrasado. */
export function canTransitionNc(from: string, to: string): boolean {
  if (!NC_STATUSES.includes(to)) return false;
  if (from === 'CLOSED') return to === 'CLOSED';
  return true;
}
