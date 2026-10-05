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
