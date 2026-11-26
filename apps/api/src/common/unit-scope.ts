// ─── Frentes de trabalho (Unit) ──────────────────────────────────────────────
//
// Cada frota pertence a uma frente de trabalho / contrato. O administrador da empresa vê todas.
// Gestor, supervisor e motorista só veem as frentes em que estão vinculados:
//   - gestor e supervisor: vínculo do login (UserUnit);
//   - motorista: vínculo do funcionário (EmployeeUnit).
//
// O TenantInterceptor guarda o escopo no contexto da requisição e a extensão do Prisma
// (prisma.service.ts) acrescenta o filtro em toda leitura, alteração e exclusão, como faz com a empresa.

import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';

export const UNIT_SCOPE_KEY = 'unitScope';

/** Perfis que veem todas as frentes da empresa. */
export const ALL_UNITS_ROLES = ['SUPER_ADMIN', 'ADMIN_EMPRESA'];

/**
 * Escopo da requisição. Sem escopo no contexto: vê todas as frentes
 * (administrador, rotas sem login, tarefas internas).
 */
export interface UnitScope {
  unitIds: string[];
  userId: string;
  employeeId: string | null;
}

export function seesAllUnits(role: string | null | undefined): boolean {
  return !!role && ALL_UNITS_ROLES.includes(role);
}

/** Escopo da requisição atual; undefined quando vê todas as frentes. */
export function currentUnitScope(): UnitScope | undefined {
  return ClsServiceManager.getClsService()?.get<UnitScope | undefined>(UNIT_SCOPE_KEY);
}

/** Frentes permitidas, ou null quando vê todas. */
export function currentUnitIds(): string[] | null {
  return currentUnitScope()?.unitIds ?? null;
}

/** Recusa a ação quando a frente não está no escopo de quem pediu. */
export function assertUnitsInScope(unitIds: string[]): void {
  const allowed = currentUnitIds();
  if (!allowed) return;
  const outside = unitIds.filter((id) => !allowed.includes(id));
  if (outside.length) throw new ForbiddenException('Você não tem acesso a esta frente de trabalho.');
}

// ── Filtros por modelo ──────────────────────────────────────────────────────

function inUnits(unitIds: string[]) {
  return { in: unitIds };
}

function fleetFilter(unitIds: string[]) {
  return { unitId: inUnits(unitIds) };
}

function vehicleFilter(unitIds: string[]) {
  return { fleet: fleetFilter(unitIds) };
}

function templateFilter(unitIds: string[]) {
  return { OR: [{ allUnits: true }, { units: { some: { unitId: inUnits(unitIds) } } }] };
}

/**
 * Filtro de cada modelo para o escopo. Modelos fora da lista não dependem de frente
 * (empresa, perfis, departamentos) ou só são lidos através de um registro já filtrado.
 */
export function unitScopeFilter(model: string, scope: UnitScope): Record<string, unknown> | null {
  const { unitIds } = scope;
  switch (model) {
    case 'Unit':
      return { id: inUnits(unitIds) };
    case 'Fleet':
      return fleetFilter(unitIds);
    case 'Vehicle':
      return vehicleFilter(unitIds);
    case 'Checklist':
      return { vehicle: vehicleFilter(unitIds) };
    case 'ChecklistAnswer':
      return { checklist: { vehicle: vehicleFilter(unitIds) } };
    case 'NonConformity':
      return { vehicle: vehicleFilter(unitIds) };
    case 'NcAction':
      return { nc: { vehicle: vehicleFilter(unitIds) } };
    case 'Template':
      return templateFilter(unitIds);
    case 'MaintenancePlan':
      // Planos da empresa toda (sem frota) e os das frotas das suas frentes.
      return { OR: [{ fleetId: null }, { fleet: fleetFilter(unitIds) }] };
    case 'MaintenanceRecord':
    case 'DrivingFeedback':
      return { vehicle: vehicleFilter(unitIds) };
    case 'Suggestion':
      // Frente gravada no envio (a da placa naquele momento).
      return { unitId: inUnits(unitIds) };
    case 'TemplateCategory':
      return { template: templateFilter(unitIds) };
    case 'TemplateItem':
      return { category: { template: templateFilter(unitIds) } };
    case 'Employee': {
      // O próprio funcionário sempre se enxerga (ex.: motorista registrando a inspeção).
      const own = scope.employeeId ? [{ id: scope.employeeId }] : [];
      return { OR: [...own, { units: { some: { unitId: inUnits(unitIds) } } }] };
    }
    case 'User':
      // O próprio login, logins vinculados às frentes e motoristas cujo funcionário está nelas.
      return {
        OR: [
          { id: scope.userId },
          { units: { some: { unitId: inUnits(unitIds) } } },
          { employee: { units: { some: { unitId: inUnits(unitIds) } } } },
        ],
      };
    default:
      return null;
  }
}

/** Junta o filtro do escopo ao where da consulta, sem perder as condições que já existem. */
export function withUnitScope(where: Record<string, unknown> | undefined, filter: Record<string, unknown>) {
  const current = where ?? {};
  const existingAnd = current.AND;
  const and = Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : [];
  return { ...current, AND: [...and, filter] };
}

// ── SQL direto (painel e relatórios) ────────────────────────────────────────

/**
 * Condição SQL "a frota está numa frente permitida" para consultas escritas à mão, que não passam
 * pela extensão do Prisma. `fleetIdColumn` é SQL confiável escrito no código (ex.: 'v."fleetId"').
 * Sem escopo: vazio.
 */
export function sqlFleetInScope(fleetIdColumn: string): Prisma.Sql {
  const unitIds = currentUnitIds();
  if (!unitIds) return Prisma.empty;
  if (unitIds.length === 0) return Prisma.sql` AND FALSE`;
  return Prisma.sql` AND ${Prisma.raw(fleetIdColumn)} IN (SELECT f."id" FROM "Fleet" f WHERE f."unitId" IN (${Prisma.join(unitIds)}))`;
}

/** Condição SQL "o veículo está numa frente permitida". `vehicleIdColumn` é SQL confiável. */
export function sqlVehicleInScope(vehicleIdColumn: string): Prisma.Sql {
  const unitIds = currentUnitIds();
  if (!unitIds) return Prisma.empty;
  if (unitIds.length === 0) return Prisma.sql` AND FALSE`;
  return Prisma.sql` AND ${Prisma.raw(vehicleIdColumn)} IN (
    SELECT v2."id" FROM "Vehicle" v2 JOIN "Fleet" f2 ON f2."id" = v2."fleetId" WHERE f2."unitId" IN (${Prisma.join(unitIds)}))`;
}

/** Condição SQL "o funcionário está numa frente permitida". `employeeIdColumn` é SQL confiável. */
export function sqlEmployeeInScope(employeeIdColumn: string): Prisma.Sql {
  const unitIds = currentUnitIds();
  if (!unitIds) return Prisma.empty;
  if (unitIds.length === 0) return Prisma.sql` AND FALSE`;
  return Prisma.sql` AND ${Prisma.raw(employeeIdColumn)} IN (SELECT eu."employeeId" FROM "EmployeeUnit" eu WHERE eu."unitId" IN (${Prisma.join(unitIds)}))`;
}

/** Condição SQL "o login está numa frente permitida" (vínculo do login ou do funcionário). */
export function sqlUserInScope(userIdColumn: string): Prisma.Sql {
  const unitIds = currentUnitIds();
  if (!unitIds) return Prisma.empty;
  if (unitIds.length === 0) return Prisma.sql` AND FALSE`;
  const units = Prisma.join(unitIds);
  return Prisma.sql` AND (${Prisma.raw(userIdColumn)} IN (SELECT uu."userId" FROM "UserUnit" uu WHERE uu."unitId" IN (${units}))
    OR ${Prisma.raw(userIdColumn)} IN (SELECT x."id" FROM "User" x JOIN "EmployeeUnit" eu ON eu."employeeId" = x."employeeId" WHERE eu."unitId" IN (${units})))`;
}

/** Condição SQL "a frente está entre as permitidas". `unitIdColumn` é SQL confiável. */
export function sqlUnitInScope(unitIdColumn: string): Prisma.Sql {
  const unitIds = currentUnitIds();
  if (!unitIds) return Prisma.empty;
  if (unitIds.length === 0) return Prisma.sql` AND FALSE`;
  return Prisma.sql` AND ${Prisma.raw(unitIdColumn)} IN (${Prisma.join(unitIds)})`;
}
