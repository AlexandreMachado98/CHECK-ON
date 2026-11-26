/** Situação de um plano de manutenção num veículo. */
export type MaintenanceState = 'VENCIDA' | 'PROXIMA' | 'SEM_KM' | 'EM_DIA';
/** Situação do veículo: a pior entre os planos dele, ou SEM_PLANO quando nenhum plano vale para ele. */
export type VehicleMaintenanceState = MaintenanceState | 'SEM_PLANO';

/** Prazo por tempo: a manutenção passa a "Próxima" quando faltam até estes dias. */
export const WARN_BEFORE_DAYS = 15;
const DAY = 24 * 60 * 60 * 1000;

/** Ordem de gravidade: o painel e a lista mostram primeiro o que está vencido. */
export const STATE_ORDER: VehicleMaintenanceState[] = ['VENCIDA', 'PROXIMA', 'SEM_KM', 'EM_DIA', 'SEM_PLANO'];

export type PlanLike = { id: string; name: string; intervalKm: number; intervalDays: number | null; warnBeforeKm: number };
export type LastDone = { km: number; performedAt: Date };

export type PlanStatus = {
  planId: string;
  planName: string;
  intervalKm: number;
  intervalDays: number | null;
  /** Km em que vence. */
  dueKm: number;
  /** Km que faltam (negativo: passou do vencimento). */
  remainingKm: number;
  /** Data em que vence pelo prazo em dias (só com manutenção registrada e plano com prazo). */
  dueDate: Date | null;
  remainingDays: number | null;
  lastKm: number | null;
  lastDate: Date | null;
  /**
   * Sem manutenção registrada: o vencimento é estimado no próximo múltiplo do intervalo
   * (veículo com 87.000 km num plano de 10.000 vence aos 90.000).
   */
  estimated: boolean;
  state: MaintenanceState;
};

/** Vencimento e situação de um plano para um veículo com o km atual `mileage`. */
export function planStatus(plan: PlanLike, mileage: number, last: LastDone | null, now = new Date()): PlanStatus {
  const baseKm = last ? last.km : Math.floor(mileage / plan.intervalKm) * plan.intervalKm;
  const dueKm = baseKm + plan.intervalKm;
  const remainingKm = dueKm - mileage;
  const dueDate = last && plan.intervalDays ? new Date(last.performedAt.getTime() + plan.intervalDays * DAY) : null;
  const remainingDays = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / DAY) : null;

  let state: MaintenanceState;
  if (!last && mileage <= 0) state = 'SEM_KM';
  else if (remainingKm <= 0 || (remainingDays !== null && remainingDays <= 0)) state = 'VENCIDA';
  else if (remainingKm <= plan.warnBeforeKm || (remainingDays !== null && remainingDays <= WARN_BEFORE_DAYS)) state = 'PROXIMA';
  else state = 'EM_DIA';

  return {
    planId: plan.id,
    planName: plan.name,
    intervalKm: plan.intervalKm,
    intervalDays: plan.intervalDays,
    dueKm,
    remainingKm,
    dueDate,
    remainingDays,
    lastKm: last?.km ?? null,
    lastDate: last?.performedAt ?? null,
    estimated: !last,
    state,
  };
}

/** A pior situação entre os planos do veículo. */
export function worstState(statuses: PlanStatus[]): VehicleMaintenanceState {
  if (!statuses.length) return 'SEM_PLANO';
  return statuses.reduce<VehicleMaintenanceState>(
    (worst, s) => (STATE_ORDER.indexOf(s.state) < STATE_ORDER.indexOf(worst) ? s.state : worst),
    'EM_DIA',
  );
}

/** Ordena os planos do veículo: mais urgente primeiro, depois o que vence antes. */
export function byUrgency(a: PlanStatus, b: PlanStatus): number {
  return STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.remainingKm - b.remainingKm;
}
