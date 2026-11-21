import { BadRequestException } from '@nestjs/common';
import { currentUnitIds } from '../common/unit-scope';

/** O mínimo do PrismaService usado aqui (facilita os testes). */
export interface UnitReader {
  unit: {
    findMany(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string }[]>;
  };
}

/**
 * Frentes de trabalho que um funcionário, login ou modelo deve ter depois de salvar.
 *
 * - `requested` undefined: na criação usa o padrão; na edição mantém como está (devolve undefined).
 * - Toda frente pedida precisa existir e estar no escopo de quem pede (a busca já é filtrada).
 * - Quem é limitado a algumas frentes não apaga vínculos com as frentes que ele não vê:
 *   eles são mantidos. E precisa deixar pelo menos uma das suas, senão o registro some para ele.
 * - Padrão na criação: as frentes de quem cria (se limitado); senão, a única frente da empresa,
 *   quando só existe uma (empresa com uma frente continua funcionando sem escolher nada).
 */
export async function resolveUnitAssignment(
  prisma: UnitReader,
  requested: string[] | undefined,
  current: string[] | null,
): Promise<string[] | undefined> {
  const scope = currentUnitIds();
  const creating = current === null;

  if (requested === undefined) {
    if (!creating) return undefined;
    if (scope) return [...scope];
    const units = await prisma.unit.findMany({ where: { isActive: true }, select: { id: true } });
    return units.length === 1 ? [units[0].id] : [];
  }

  const ids = [...new Set(requested)];
  if (ids.length) {
    const found = await prisma.unit.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new BadRequestException('Frente de trabalho não encontrada.');
  }
  if (!scope) return ids;

  if (ids.length === 0) throw new BadRequestException('Escolha pelo menos uma frente de trabalho.');
  const keptOutside = (current ?? []).filter((id) => !scope.includes(id));
  return [...new Set([...keptOutside, ...ids])];
}

/** Include das frentes de um registro, mostrando só as que quem pede pode ver. */
export function visibleUnitsInclude() {
  const scope = currentUnitIds();
  return {
    where: scope ? { unitId: { in: scope } } : undefined,
    select: { unit: { select: { id: true, name: true, client: true } } },
  };
}
