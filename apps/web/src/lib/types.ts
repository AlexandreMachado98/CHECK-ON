// Shared domain types for the web app

export interface Fleet {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Vehicle {
  id: string;
  plate: string;
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
  email?: string;
  phone?: string;
  cpf?: string;
  role: string; // e.g. 'MOTORISTA', 'TECNICO', 'OPERADOR'
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

