/**
 * Perfis padrão de cada empresa cliente. Os nomes são os usados nos @Roles(...) dos controllers.
 * SUPER_ADMIN fica fora: só existe na empresa da plataforma e nunca é atribuído pelo painel.
 */
export const SUPER_ADMIN = 'SUPER_ADMIN';
export const ADMIN_EMPRESA = 'ADMIN_EMPRESA';
export const GESTOR = 'GESTOR';
export const SUPERVISOR = 'SUPERVISOR';
export const MOTORISTA = 'MOTORISTA';

/**
 * Perfis com acesso às telas do painel (veículos, inspeções, NCs, usuários...).
 * O super admin entra junto para poder usar e testar todas as telas; ele opera nos dados
 * da empresa dele (a da plataforma). Para os dados de um cliente, usa "Acessar empresa".
 */
export const PANEL_ROLES = [SUPER_ADMIN, 'ADMIN_EMPRESA', 'GESTOR'];

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
  // O super admin, na empresa da plataforma, cadastra usuários como um administrador (nunca outro SUPER_ADMIN).
  if (requesterRole === ADMIN_EMPRESA || requesterRole === SUPER_ADMIN) return [ADMIN_EMPRESA, GESTOR, SUPERVISOR, MOTORISTA];
  if (requesterRole === GESTOR) return [GESTOR, SUPERVISOR, MOTORISTA];
  return [];
}
