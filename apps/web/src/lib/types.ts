// Shared domain types for the web app

export interface Fleet {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  vehicles?: Vehicle[];
  _count?: { vehicles: number };
}

export interface Vehicle {
  id: string;
  plate: string;
  prefix?: string;
  brand: string;
  model: string;
  year: number;
  isActive: boolean;
  /** Status operacional calculado pelas NCs ativas. */
  status?: VehicleStatus;
  mileage?: number;
  fleetId: string;
  fleet?: Pick<Fleet, 'id' | 'name'> & Partial<Fleet>;
  /** NCs ativas (abertas ou em tratativa) do veículo. */
  _count?: { ncs: number };
}

export type VehicleStatus = 'LIBERADO' | 'ATENCAO' | 'BLOQUEADO';

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role?: Role;
  roleId: string;
}

export interface Employee {
  id: string;
  name: string;
  matricula?: string;
  jobTitle?: string;
  role?: string;
  admissionDate?: string | null;
  departmentName?: string | null;
  supervisorId?: string | null;
  supervisor?: Pick<Employee, 'id' | 'name' | 'jobTitle'> | null;
  tenant?: { name: string };
  photoUrl?: string | null;
  badgeToken?: string | null;
  companyIntegrationDate?: string | null;
  companyIntegrationExpiresAt?: string | null;
  clientIntegrationDate?: string | null;
  clientIntegrationExpiresAt?: string | null;
  trainings?: EmployeeTraining[];
  isActive: boolean;
  userId?: string;
  user?: User;
}

export interface EmployeeTraining {
  id?: string;
  name: string;
  completedAt: string;
  expiresAt?: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: Role;
}

// ─── Checklist Builder ────────────────────────────────────────────────────────

export type ItemType = 'PASS_FAIL' | 'TEXT' | 'NUMBER' | 'PHOTO';

export interface TemplateItem {
  id: string;
  text: string;
  type: ItemType;
  isRequired: boolean;
  /** Não conforme em item crítico gera NC crítica e bloqueia o veículo. */
  isCritical: boolean;
  /** Quando a resposta precisa vir com foto. Não se aplica a itens do tipo PHOTO. */
  photoRequirement: PhotoRequirement;
  order: number;
  categoryId: string;
}

export type PhotoRequirement = 'NONE' | 'ON_NON_COMPLIANCE' | 'ALWAYS';

export interface TemplateCategory {
  id: string;
  name: string;
  order: number;
  templateId: string;
  items: TemplateItem[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  categories: TemplateCategory[];
  _count?: { categories: number };
}

export interface ChecklistAnswer {
  id: string;
  itemId: string;
  isCompliant: boolean;
  textValue?: string | null;
  numberValue?: number | null;
  photoUrl?: string | null;
  observations?: string | null;
  /** NC ativa à qual esta resposta foi agrupada (reincidência). */
  recurrentNcId?: string | null;
  item?: TemplateItem;
  nonConformity?: NC | null;
}

export interface Checklist {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  syncedAt?: string | null;
  clientId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vehicleId: string;
  driverId: string;
  templateId: string;
  vehicle?: Vehicle;
  driver?: Employee;
  template?: Template;
  answers?: ChecklistAnswer[];
}

export type NCStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type NCSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NC {
  id: string;
  status: NCStatus;
  severity: NCSeverity;
  notes?: string | null;
  occurrences: number;
  lastOccurrenceAt?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  answerId: string;
  vehicleId?: string | null;
  itemId?: string | null;
  vehicle?: Vehicle | null;
  item?: TemplateItem | null;
  answer?: ChecklistAnswer & {
    checklist?: Checklist;
    item?: TemplateItem;
  };
  _count?: { recurrences: number };
}

export interface DashboardSummary {
  activeVehicles: number;
  activeFleets: number;
  activeEmployees: number;
  activeUsers: number;
  vehicleStatus: Record<VehicleStatus, number>;
  ncs: { active: number; critical: number; recurrent: number };
  inspections: { today: number; last7Days: number };
}

/** Extrai a mensagem de erro devolvida pela API NestJS. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (message) return message;
  // Erro gerado no próprio painel (ex.: resposta inesperada da API): a mensagem já está em português.
  if (error instanceof Error && !(error as { isAxiosError?: boolean }).isAxiosError) return error.message || fallback;
  return fallback;
}
