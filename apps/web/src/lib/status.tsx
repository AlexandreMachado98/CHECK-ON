import { Badge } from '@/components/ui/badge';
import type { NCSeverity, NCStatus, VehicleStatus } from './types';

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; className: string; description: string }> = {
  LIBERADO: { label: 'Liberado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', description: 'Sem pendências ativas' },
  ATENCAO: { label: 'Atenção', className: 'bg-amber-50 text-amber-800 border-amber-200', description: 'Tem NC ativa não crítica' },
  BLOQUEADO: { label: 'Bloqueado', className: 'bg-rose-50 text-rose-700 border-rose-200', description: 'Tem NC crítica ativa' },
};

export const NC_STATUS: Record<NCStatus, { label: string; className: string }> = {
  OPEN: { label: 'Aberta', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  IN_PROGRESS: { label: 'Em tratativa', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  RESOLVED: { label: 'Resolvida', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Encerrada', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const NC_SEVERITY: Record<NCSeverity, { label: string; className: string }> = {
  CRITICAL: { label: 'Crítica', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  HIGH: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  MEDIUM: { label: 'Média', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  LOW: { label: 'Baixa', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export const isActiveNc = (status: string) => status === 'OPEN' || status === 'IN_PROGRESS';

export function VehicleStatusBadge({ status }: { status?: string | null }) {
  const config = VEHICLE_STATUS[(status as VehicleStatus) ?? 'LIBERADO'] ?? VEHICLE_STATUS.LIBERADO;
  return <Badge variant="outline" className={config.className} title={config.description}>{config.label}</Badge>;
}

export function NcStatusBadge({ status }: { status: string }) {
  const config = NC_STATUS[status as NCStatus];
  return <Badge variant="outline" className={config?.className}>{config?.label ?? status}</Badge>;
}

export function NcSeverityBadge({ severity }: { severity: string }) {
  const config = NC_SEVERITY[severity as NCSeverity];
  return <Badge variant="outline" className={config?.className}>{config?.label ?? severity}</Badge>;
}
