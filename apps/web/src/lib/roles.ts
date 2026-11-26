/**
 * Perfis do sistema e o que cada um vê no painel.
 * Precisa bater com os @Roles(...) da API: o menu esconde o que a API negaria com 403.
 */
export const SUPER_ADMIN = 'SUPER_ADMIN';
export const ADMIN_EMPRESA = 'ADMIN_EMPRESA';
export const GESTOR = 'GESTOR';
export const SUPERVISOR = 'SUPERVISOR';

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN_EMPRESA: 'Administrador da empresa',
  GESTOR: 'Gestor',
  SUPERVISOR: 'Supervisor',
  MOTORISTA: 'Motorista',
};

export function roleLabel(role?: string | null): string {
  if (!role) return 'Sem perfil';
  return ROLE_LABELS[role] ?? role;
}

/** Perfis que usam o portal. O motorista usa só o aplicativo. */
export const PANEL_ROLES = [SUPER_ADMIN, ADMIN_EMPRESA, GESTOR, SUPERVISOR];

/** Administrador da empresa (e super admin): vê todas as frentes de trabalho. */
export function seesAllUnits(role?: string | null): boolean {
  return role === SUPER_ADMIN || role === ADMIN_EMPRESA;
}

/** Supervisor opera (consulta, trata NCs, libera/bloqueia veículos), mas não cadastra nem cria acessos. */
export function canManage(role?: string | null): boolean {
  return !!role && role !== SUPERVISOR;
}

/** Telas de cada perfil. Cada empresa só vê os próprios dados (a API filtra pela empresa do login). */
const COMPANY_PATHS = [
  '/dashboard',
  '/dashboard/templates',
  '/dashboard/executions',
  '/dashboard/ncs',
  '/dashboard/driving',
  '/dashboard/vehicles',
  '/dashboard/fleets',
  '/dashboard/maintenance',
  '/dashboard/employees',
  '/dashboard/users',
  '/dashboard/reports',
  '/dashboard/settings',
];
/** Frentes de trabalho: só o administrador cadastra (os demais veem só as frentes deles). */
const ADMIN_ONLY_PATHS = ['/dashboard/frentes'];
/** Tela de troca da própria senha: todos os perfis do portal. */
const ACCOUNT_PATHS = ['/dashboard/conta'];

const SUPERVISOR_PATHS = [
  '/dashboard',
  '/dashboard/executions',
  '/dashboard/ncs',
  '/dashboard/driving',
  '/dashboard/vehicles',
  '/dashboard/fleets',
  '/dashboard/maintenance',
  '/dashboard/employees',
  '/dashboard/reports',
];

const PATHS_BY_ROLE: Record<string, string[]> = {
  // O super admin vê todas as telas (dados da empresa da plataforma) e, além delas, Empresas.
  SUPER_ADMIN: [...COMPANY_PATHS, ...ADMIN_ONLY_PATHS, '/dashboard/tenants', ...ACCOUNT_PATHS],
  ADMIN_EMPRESA: [...COMPANY_PATHS, ...ADMIN_ONLY_PATHS, ...ACCOUNT_PATHS],
  GESTOR: [...COMPANY_PATHS, ...ACCOUNT_PATHS],
  SUPERVISOR: [...SUPERVISOR_PATHS, ...ACCOUNT_PATHS],
};

export function homePathFor(): string {
  return '/dashboard';
}

/** Libera a tela e as subtelas dela (ex.: /dashboard/templates/123). */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  const allowed = PATHS_BY_ROLE[role ?? ''] ?? [];
  return allowed.some((path) => pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`)));
}
