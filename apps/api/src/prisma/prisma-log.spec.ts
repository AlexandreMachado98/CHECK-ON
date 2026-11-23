import { describe, expect, it } from 'vitest';
import { isHandledPrismaError } from './prisma.service';

describe('Log do Prisma', () => {
  it('valor repetido em campo único (tratado como 409/DUPLICATE) vira aviso, não erro', () => {
    expect(isHandledPrismaError('Invalid `tx.checklist.create()` invocation:\n\nUnique constraint failed on the fields: (`tenantId`,`clientId`)')).toBe(true);
  });

  it('erros de verdade continuam como erro', () => {
    expect(isHandledPrismaError("Can't reach database server at `db:5432`")).toBe(false);
    expect(isHandledPrismaError('Foreign key constraint failed on the field: `vehicleId`')).toBe(false);
  });
});
