/**
 * Perfis do sistema e o que cada um vê no painel.
 * Precisa bater com os @Roles(...) da API: o menu esconde o que a API negaria com 403.
 */
export const SUPER_ADMIN = 'SUPER_ADMIN';
export const ADMIN_EMPRESA = 'ADMIN_EMPRESA';
export const GESTOR = 'GESTOR';

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

/** Perfis que usam o painel web. Supervisor e motorista usam só o aplicativo. */
export const PANEL_ROLES = [SUPER_ADMIN, ADMIN_EMPRESA, GESTOR];

/** Telas de cada perfil. Cada empresa só vê os próprios dados (a API filtra pela empresa do login). */
const COMPANY_PATHS = [
  '/dashboard',
  '/dashboard/templates',
  '/dashboard/executions',
  '/dashboard/ncs',
  '/dashboard/vehicles',
  '/dashboard/fleets',
  '/dashboard/employees',
  '/dashboard/users',
  '/dashboard/reports',
  '/dashboard/settings',
];
const PATHS_BY_ROLE: Record<string, string[]> = {
  // O super admin vê todas as telas (dados da empresa da plataforma) e, além delas, Empresas.
  SUPER_ADMIN: [...COMPANY_PATHS, '/dashboard/tenants'],
  ADMIN_EMPRESA: COMPANY_PATHS,
  GESTOR: COMPANY_PATHS,
};

export function homePathFor(): string {
  return '/dashboard';
}

/** Libera a tela e as subtelas dela (ex.: /dashboard/templates/123). */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  const allowed = PATHS_BY_ROLE[role ?? ''] ?? [];
  return allowed.some((path) => pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`)));
}
