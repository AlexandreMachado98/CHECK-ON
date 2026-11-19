import { Prisma } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';
import { ForbiddenException } from '@nestjs/common';

const ACCENTED = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const PLAIN = 'aaaaaeeeeiiiiooooouuuucn';

/** Busca sem acento e sem maiúsculas: "joao" encontra "João". Sem extensão no banco (usa translate). */
export function normalizeTerm(term: string): string {
  return term.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Padrão LIKE "contém", com %, _ e \ do usuário tratados como texto. */
export function containsPattern(term: string): string {
  return `%${normalizeTerm(term).replace(/[\\%_]/g, '\\$&')}%`;
}

/** Expressão SQL da coluna sem acento e em minúsculas. `column` é SQL confiável escrito no código. */
export function plain(column: string): Prisma.Sql {
  return Prisma.sql`translate(lower(coalesce(${Prisma.raw(column)}, '')), ${ACCENTED}, ${PLAIN})`;
}

export function currentTenantId(): string {
  const tenantId = ClsServiceManager.getClsService()?.get<string>('tenantId');
  if (!tenantId) throw new ForbiddenException('Empresa não identificada na sessão.');
  return tenantId;
}

/** Limite de resultados de uma busca (a lista é paginada; isso só protege o banco). */
export const SEARCH_LIMIT = 5000;
