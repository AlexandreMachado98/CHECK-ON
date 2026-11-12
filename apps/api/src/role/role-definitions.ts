/**
 * Perfis padrão de cada empresa cliente. Os nomes são os usados nos @Roles(...) dos controllers.
 * SUPER_ADMIN fica fora: só existe na empresa da plataforma e nunca é atribuído pelo painel.
 */
export const SUPER_ADMIN = 'SUPER_ADMIN';
export const ADMIN_EMPRESA = 'ADMIN_EMPRESA';
export const GESTOR = 'GESTOR';
export const SUPERVISOR = 'SUPERVISOR';
export const MOTORISTA = 'MOTORISTA';

export const DEFAULT_TENANT_ROLES: ReadonlyArray<{ name: string; label: string; permissions: string[] }> = [
  { name: ADMIN_EMPRESA, label: 'Administrador da empresa', permissions: ['*'] },
  { name: GESTOR, label: 'Gestor', permissions: ['fleet:*', 'checklist:*', 'nc:*', 'employees:*', 'users:*'] },
  { name: SUPERVISOR, label: 'Supervisor', permissions: ['checklist:execute', 'checklist:read'] },
  { name: MOTORISTA, label: 'Motorista', permissions: ['checklist:execute'] },
];

export const ROLE_LABELS: Record<string, string> = {
  [SUPER_ADMIN]: 'Super administrador',
  ...Object.fromEntries(DEFAULT_TENANT_ROLES.map((role) => [role.name, role.label])),
};

/**
 * Quem pode atribuir qual perfil. Ninguém atribui SUPER_ADMIN pelo painel,
 * e um gestor não cria nem altera administradores da empresa.
 */
export function assignableRoleNames(requesterRole: string): string[] {
  if (requesterRole === ADMIN_EMPRESA) return [ADMIN_EMPRESA, GESTOR, SUPERVISOR, MOTORISTA];
  if (requesterRole === GESTOR) return [GESTOR, SUPERVISOR, MOTORISTA];
  return [];
}
