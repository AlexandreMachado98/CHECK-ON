import { formatKm } from './utils';

/** Situação de um plano no veículo (igual à API). */
export type MaintenanceState = 'VENCIDA' | 'PROXIMA' | 'SEM_KM' | 'EM_DIA';
export type VehicleMaintenanceState = MaintenanceState | 'SEM_PLANO';

export interface MaintenancePlan {
  id: string;
  name: string;
  intervalKm: number;
  intervalDays: number | null;
  warnBeforeKm: number;
  fleetId: string | null;
  fleet?: { id: string; name: string; unit?: { name: string } | null } | null;
  /** Falso para quem é limitado a frentes num plano da empresa toda (só o administrador altera). */
  canEdit?: boolean;
}

export interface PlanStatus {
  planId: string;
  planName: string;
  intervalKm: number;
  intervalDays: number | null;
  dueKm: number;
  remainingKm: number;
  dueDate: string | null;
  remainingDays: number | null;
  lastKm: number | null;
  lastDate: string | null;
  /** Sem manutenção registrada: vencimento estimado no próximo múltiplo do intervalo. */
  estimated: boolean;
  state: MaintenanceState;
}

export interface MaintenanceVehicle {
  id: string;
  plate: string;
  prefix?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  mileage: number;
  status: string;
  fleetId: string;
  fleet?: { id: string; name: string; unit?: { id: string; name: string } | null } | null;
  state: VehicleMaintenanceState;
  plans: PlanStatus[];
}

export interface MaintenanceOverview {
  plans: number;
  summary: Record<VehicleMaintenanceState, number>;
  vehicles: MaintenanceVehicle[];
}

export interface MaintenanceRecord {
  id: string;
  planId: string | null;
  title: string;
  performedAt: string;
  km: number;
  workshop: string | null;
  cost: number | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface MaintenanceVehicleDetail {
  vehicle: Omit<MaintenanceVehicle, 'state' | 'plans'> & { isActive: boolean };
  state: VehicleMaintenanceState;
  plans: PlanStatus[];
  records: MaintenanceRecord[];
  readings: { id: string; completedAt: string | null; odometerKm: number; driver?: { name: string } | null }[];
}

/** Ordem e textos das situações (filtros, contadores e selos). */
export const STATE_INFO: Record<VehicleMaintenanceState, { label: string; plural: string; badge: string; dot: string }> = {
  VENCIDA: { label: 'Vencida', plural: 'Vencidas', badge: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-600' },
  PROXIMA: { label: 'Próxima', plural: 'Próximas', badge: 'bg-amber-50 text-amber-900 border-amber-200', dot: 'bg-amber-500' },
  SEM_KM: { label: 'Sem km', plural: 'Sem km informado', badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  EM_DIA: { label: 'Em dia', plural: 'Em dia', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' },
  SEM_PLANO: { label: 'Sem plano', plural: 'Sem plano', badge: 'bg-white text-slate-600 border-slate-200', dot: 'bg-slate-300' },
};
export const STATE_ORDER: VehicleMaintenanceState[] = ['VENCIDA', 'PROXIMA', 'SEM_KM', 'EM_DIA', 'SEM_PLANO'];

/** "a cada 10.000 km ou 180 dias". */
export function intervalText(plan: { intervalKm: number; intervalDays: number | null }): string {
  return `a cada ${formatKm(plan.intervalKm)}${plan.intervalDays ? ` ou ${plan.intervalDays} dias` : ''}`;
}

/** Quanto falta ou quanto passou: "faltam 4.500 km", "passou 1.300 km", "vence em 10 dias". */
export function dueText(s: PlanStatus): string {
  if (s.state === 'SEM_KM') return 'Aguardando o primeiro km informado nas inspeções';
  const km = s.remainingKm > 0 ? `faltam ${formatKm(s.remainingKm)}` : s.remainingKm === 0 ? 'vence agora' : `passou ${formatKm(-s.remainingKm)}`;
  const days = s.remainingDays === null ? '' : s.remainingDays > 0 ? ` · ${s.remainingDays} ${s.remainingDays === 1 ? 'dia' : 'dias'} pelo prazo` : ' · prazo em dias vencido';
  return `Vence aos ${formatKm(s.dueKm)} (${km})${days}`;
}

/** "R$ 1.234,56". */
export function formatMoney(value: number | null | undefined): string {
  return value == null ? '' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Valor digitado ("1.234,56" ou "1234.56") em número; null se vazio, NaN se inválido. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[R$\s]/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}
