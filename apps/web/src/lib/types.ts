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
  fleetId: string;
  fleet?: Fleet;
}

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
  email?: string;
  phone?: string;
  cpf?: string;
  isActive: boolean;
  userId?: string;
  user?: User;
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
  order: number;
  categoryId: string;
}

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
  value: string;
  photoUrl?: string;
  item?: TemplateItem;
  nonConformity?: NC;
}

export interface Checklist {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  vehicleId: string;
  driverId: string;
  templateId: string;
  vehicle?: Vehicle;
  driver?: Employee;
  template?: Template;
  answers?: ChecklistAnswer[];
}

export interface NC {
  id: string;
  status: string;
  severity: string;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
  answerId: string;
  answer?: ChecklistAnswer & {
    checklist?: Checklist;
    item?: TemplateItem;
  };
}

