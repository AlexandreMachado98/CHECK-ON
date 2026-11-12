import { describe, expect, it } from 'vitest';
import { DEFAULT_TENANT_ROLES, ROLE_LABELS, assignableRoleNames } from './role-definitions';

describe('assignableRoleNames', () => {
  it('administrador da empresa atribui todos os perfis da empresa', () => {
    expect(assignableRoleNames('ADMIN_EMPRESA')).toEqual(['ADMIN_EMPRESA', 'GESTOR', 'SUPERVISOR', 'MOTORISTA']);
  });

  it('gestor não cria administrador', () => {
    expect(assignableRoleNames('GESTOR')).not.toContain('ADMIN_EMPRESA');
    expect(assignableRoleNames('GESTOR')).toContain('MOTORISTA');
  });

  it('ninguém atribui SUPER_ADMIN pelo painel', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'GESTOR', 'SUPERVISOR', 'MOTORISTA']) {
      expect(assignableRoleNames(role)).not.toContain('SUPER_ADMIN');
    }
  });

  it('supervisor, motorista e perfis desconhecidos não atribuem nada', () => {
    expect(assignableRoleNames('SUPERVISOR')).toEqual([]);
    expect(assignableRoleNames('MOTORISTA')).toEqual([]);
    expect(assignableRoleNames('QUALQUER')).toEqual([]);
  });
});

describe('perfis padrão', () => {
  it('toda empresa nasce com administrador, gestor, supervisor e motorista, todos com nome em português', () => {
    expect(DEFAULT_TENANT_ROLES.map((r) => r.name)).toEqual(['ADMIN_EMPRESA', 'GESTOR', 'SUPERVISOR', 'MOTORISTA']);
    for (const role of DEFAULT_TENANT_ROLES) expect(ROLE_LABELS[role.name]).toBeTruthy();
  });
});
