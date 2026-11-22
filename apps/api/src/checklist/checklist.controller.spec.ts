import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ChecklistController } from './checklist.controller';

describe('ChecklistController — quem exclui inspeção', () => {
  it('só o administrador da empresa (e o super admin) excluem inspeções', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ChecklistController.prototype.remove);
    expect(roles).toEqual(['ADMIN_EMPRESA', 'SUPER_ADMIN']);
  });

  it('gestor e supervisor continuam consultando', () => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, ChecklistController.prototype.findOne);
    expect(roles).toEqual(expect.arrayContaining(['GESTOR', 'SUPERVISOR']));
  });
});
