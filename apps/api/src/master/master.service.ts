import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SessionGuardCache } from '../auth/session-guard.cache';
import { generateTemporaryPassword } from '../auth/password';
import { TenantAdminService } from '../tenant-admin/tenant-admin.service';
import { ADMIN_EMPRESA } from '../role/role-definitions';
import {
  addDaysEndOfDay,
  addMonthsEndOfDay,
  endOfDayBrasilia,
  subscriptionInfo,
  type SubscriptionInfo,
} from '../subscription/subscription';
import { CreateMasterCompanyDto, RenewMasterCompanyDto, ResetAdminPasswordDto, UpdateMasterCompanyDto } from './dto/master-company.dto';

const COMPANY_SELECT = {
  id: true,
  name: true,
  cnpj: true,
  code: true,
  plan: true,
  isActive: true,
  billingCycle: true,
  subscriptionEndsAt: true,
  graceDays: true,
  masterNotes: true,
  archivedAt: true,
  createdAt: true,
} as const;

type CompanyRow = {
  id: string;
  name: string;
  cnpj: string | null;
  code: string | null;
  plan: string;
  isActive: boolean;
  billingCycle: string;
  subscriptionEndsAt: Date | null;
  graceDays: number;
  masterNotes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
};

type UsageRow = {
  id: string;
  users: bigint;
  employees: bigint;
  vehicles: bigint;
  inspections30d: bigint;
  lastInspectionAt: Date | null;
  openNcs: bigint;
};

export type Usage = { users: number; employees: number; vehicles: number; inspections30d: number; lastInspectionAt: string | null; openNcs: number };

const EMPTY_USAGE: Usage = { users: 0, employees: 0, vehicles: 0, inspections30d: 0, lastInspectionAt: null, openNcs: 0 };

/**
 * Operações do DDS Master sobre os clientes do CHECK-ON (assinatura, código do app, suspensão).
 * Não há empresa no contexto da requisição: toda consulta filtra a empresa de forma explícita.
 * A empresa da plataforma (a do super admin) nunca aparece nem pode ser alterada por aqui.
 */
@Injectable()
export class MasterService {
  private readonly logger = new Logger('MasterApi');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionCache: SessionGuardCache,
    private readonly tenantAdmin: TenantAdminService,
    private readonly storage: StorageService,
  ) {}

  async summary() {
    const [companies, archived] = await Promise.all([this.listCompanies(), this.listCompanies(true)]);
    const byState: Record<string, number> = { ATIVA: 0, TESTE: 0, CARENCIA: 0, VENCIDA: 0, SUSPENSA: 0 };
    companies.forEach((c) => (byState[c.subscription.state] = (byState[c.subscription.state] ?? 0) + 1));
    const expiringSoon = companies
      .filter((c) => ['ATIVA', 'TESTE'].includes(c.subscription.state) && c.subscription.daysLeft !== null && c.subscription.daysLeft <= 7)
      .sort((a, b) => (a.subscription.daysLeft ?? 0) - (b.subscription.daysLeft ?? 0));
    return {
      totalCompanies: companies.length,
      byState,
      archived: archived.length,
      expiringIn7Days: expiringSoon.length,
      expiringSoon: expiringSoon.slice(0, 10).map((c) => ({ id: c.id, name: c.name, code: c.code, subscription: c.subscription })),
      inspections30d: companies.reduce((sum, c) => sum + c.usage.inspections30d, 0),
      vehicles: companies.reduce((sum, c) => sum + c.usage.vehicles, 0),
    };
  }

  /** Clientes ativos na lista (padrão) ou só os arquivados. */
  async listCompanies(archived = false) {
    const platform = await this.platformTenantIds();
    const [rows, usage] = await Promise.all([
      this.prisma.tenant.findMany({ where: { archivedAt: archived ? { not: null } : null }, select: COMPANY_SELECT, orderBy: { name: 'asc' } }),
      this.usageByTenant(),
    ]);
    return rows.filter((row) => !platform.has(row.id)).map((row) => this.view(row, usage.get(row.id)));
  }

  async getCompany(id: string) {
    const row = await this.findCompany(id);
    const [usage, admins, history] = await Promise.all([
      this.usageByTenant(id),
      this.prisma.user.findMany({
        where: { tenantId: id, role: { name: ADMIN_EMPRESA } },
        select: { id: true, name: true, email: true, isActive: true, mustChangePassword: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.history(id, 30),
    ]);
    return { ...this.view(row, usage.get(id)), admins, history };
  }

  /** Cria a empresa com o primeiro administrador. A senha provisória volta uma única vez. */
  async createCompany(dto: CreateMasterCompanyDto, actor?: string) {
    const now = new Date();
    const subscriptionEndsAt = dto.subscriptionEndsAt
      ? this.parseDate(dto.subscriptionEndsAt)
      : dto.billingCycle === 'TESTE'
        ? addDaysEndOfDay(now, dto.trialDays ?? 15)
        : addMonthsEndOfDay(now, dto.billingCycle === 'ANUAL' ? 12 : 1);
    const temporaryPassword = generateTemporaryPassword();

    const tenant = await this.tenantAdmin.create(
      { name: dto.name, cnpj: dto.cnpj, code: dto.code, adminName: dto.adminName, adminEmail: dto.adminEmail, adminPassword: temporaryPassword },
      { billingCycle: dto.billingCycle, subscriptionEndsAt, graceDays: dto.graceDays ?? 5, masterNotes: dto.notes?.trim() || null },
    );
    await this.audit(tenant.id, 'COMPANY_CREATED', actor, {
      name: dto.name,
      code: dto.code,
      billingCycle: dto.billingCycle,
      subscriptionEndsAt: subscriptionEndsAt.toISOString(),
      adminEmail: dto.adminEmail,
    });
    this.logger.log(`DDS Master criou a empresa "${dto.name}" (${tenant.id}).`);

    return {
      company: await this.getCompany(tenant.id),
      credentials: { companyCode: dto.code, adminEmail: dto.adminEmail, temporaryPassword },
    };
  }

  async updateCompany(id: string, dto: UpdateMasterCompanyDto, actor?: string) {
    const current = this.assertNotArchived(await this.findCompany(id));
    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const set = (field: keyof CompanyRow, value: unknown, label: string = field) => {
      const before = current[field];
      const same = before instanceof Date && value instanceof Date ? before.getTime() === value.getTime() : before === value;
      if (same) return;
      data[field] = value;
      changes[label] = { from: before instanceof Date ? before.toISOString() : before, to: value instanceof Date ? value.toISOString() : value };
    };

    if (dto.name !== undefined) set('name', dto.name);
    if (dto.cnpj !== undefined) {
      const cnpj = dto.cnpj || null;
      if (cnpj && (await this.prisma.tenant.findFirst({ where: { cnpj, NOT: { id } }, select: { id: true } }))) {
        throw new ConflictException('Este CNPJ já está cadastrado em outra empresa.');
      }
      set('cnpj', cnpj);
    }
    if (dto.code !== undefined) {
      if (await this.prisma.tenant.findFirst({ where: { code: { equals: dto.code, mode: 'insensitive' }, NOT: { id } }, select: { id: true } })) {
        throw new ConflictException('Este código já é usado por outra empresa.');
      }
      set('code', dto.code);
    }
    if (dto.billingCycle !== undefined) set('billingCycle', dto.billingCycle);
    if (dto.subscriptionEndsAt !== undefined) set('subscriptionEndsAt', dto.subscriptionEndsAt === null ? null : this.parseDate(dto.subscriptionEndsAt));
    if (dto.graceDays !== undefined) set('graceDays', dto.graceDays);
    if (dto.notes !== undefined) set('masterNotes', dto.notes.trim() || null, 'notes');
    if (dto.isActive !== undefined) set('isActive', dto.isActive);

    if (Object.keys(data).length === 0) return this.getCompany(id);
    await this.prisma.tenant.update({ where: { id }, data });
    // Suspensão, vencimento e código valem na hora (sem esperar o cache de 30 s desta instância).
    this.sessionCache.invalidateTenant(id);

    const action =
      dto.isActive === false && current.isActive ? 'COMPANY_SUSPENDED'
        : dto.isActive === true && !current.isActive ? 'COMPANY_REACTIVATED'
          : changes.code ? 'CODE_CHANGED'
            : 'COMPANY_UPDATED';
    await this.audit(id, action, actor, changes);
    return this.getCompany(id);
  }

  async renew(id: string, dto: RenewMasterCompanyDto, actor?: string) {
    const current = this.assertNotArchived(await this.findCompany(id));
    if (dto.months === undefined && dto.until === undefined && dto.billingCycle === undefined) {
      throw new BadRequestException('Informe por quantos meses renovar ou a data do novo vencimento.');
    }
    const now = new Date();
    const cycle = dto.billingCycle ?? (current.billingCycle === 'TESTE' ? ((dto.months ?? 1) >= 12 ? 'ANUAL' : 'MENSAL') : current.billingCycle);
    let endsAt: Date;
    if (dto.until) {
      endsAt = this.parseDate(dto.until);
      if (endsAt.getTime() <= now.getTime()) throw new BadRequestException('O novo vencimento precisa ser uma data futura.');
    } else {
      // Renovou antes de vencer: soma ao vencimento atual (o cliente não perde dias). Já vencida: a partir de hoje.
      const base = current.subscriptionEndsAt && current.subscriptionEndsAt.getTime() > now.getTime() ? current.subscriptionEndsAt : now;
      endsAt = addMonthsEndOfDay(base, dto.months ?? (cycle === 'ANUAL' ? 12 : 1));
    }
    await this.prisma.tenant.update({ where: { id }, data: { subscriptionEndsAt: endsAt, billingCycle: cycle } });
    this.sessionCache.invalidateTenant(id);
    await this.audit(id, 'SUBSCRIPTION_RENEWED', actor, {
      from: current.subscriptionEndsAt?.toISOString() ?? null,
      to: endsAt.toISOString(),
      billingCycle: cycle,
    });
    return this.getCompany(id);
  }

  /** Nova senha provisória para o administrador da empresa (ele troca no primeiro acesso). */
  async resetAdminPassword(id: string, dto: ResetAdminPasswordDto, actor?: string) {
    this.assertNotArchived(await this.findCompany(id));
    const admin = await this.prisma.user.findFirst({
      where: { tenantId: id, role: { name: ADMIN_EMPRESA }, ...(dto.userId ? { id: dto.userId } : { isActive: true }) },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new NotFoundException('Administrador da empresa não encontrado.');
    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: admin.id },
        data: {
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          isActive: true,
        },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.sessionCache.invalidateUser(admin.id);
    await this.audit(id, 'ADMIN_PASSWORD_RESET', actor, { adminEmail: admin.email });
    return { credentials: { adminName: admin.name, adminEmail: admin.email, temporaryPassword } };
  }

  /**
   * "Excluir" no Master: arquiva. Some das listas, ninguém entra (sessões abertas caem), dados preservados.
   */
  async archive(id: string, actor?: string) {
    const current = await this.findCompany(id);
    if (current.archivedAt) return this.getCompany(id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id }, data: { archivedAt: now, isActive: false, sessionsRevokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { revokedAt: null, user: { tenantId: id } }, data: { revokedAt: now } }),
    ]);
    this.sessionCache.invalidateTenant(id);
    await this.audit(id, 'COMPANY_ARCHIVED', actor, { name: current.name, code: current.code, wasActive: current.isActive });
    return this.getCompany(id);
  }

  /** Desfaz o arquivamento: volta à situação de antes (ativa ou suspensa). */
  async restore(id: string, actor?: string) {
    const current = await this.findCompany(id);
    if (!current.archivedAt) return this.getCompany(id);
    const last = await this.prisma.masterAuditLog.findFirst({
      where: { tenantId: id, action: 'COMPANY_ARCHIVED' },
      orderBy: { createdAt: 'desc' },
      select: { details: true },
    });
    const details = last?.details ? (safeJson(last.details) as { wasActive?: boolean }) : {};
    const isActive = details?.wasActive !== false;
    await this.prisma.tenant.update({ where: { id }, data: { archivedAt: null, isActive } });
    this.sessionCache.invalidateTenant(id);
    await this.audit(id, 'COMPANY_RESTORED', actor, { isActive });
    return this.getCompany(id);
  }

  /** O que será apagado por "Excluir definitivamente" (para a tela de confirmação). */
  async deletionPreview(id: string) {
    const company = await this.findCompany(id);
    return { id, name: company.name, code: company.code, archived: !!company.archivedAt, counts: await this.counts(id) };
  }

  /**
   * Apaga a empresa e todos os dados dela, sem volta. Só para empresa já arquivada e com o nome
   * digitado igual (confirmação). O registro da exclusão fica no histórico do Master.
   */
  async deletePermanently(id: string, confirmName: string, actor?: string) {
    const company = await this.findCompany(id);
    if (!company.archivedAt) throw new BadRequestException('Arquive a empresa antes de excluir definitivamente.');
    const typed = (confirmName ?? '').trim().toLocaleLowerCase('pt-BR');
    if (!typed || typed !== company.name.trim().toLocaleLowerCase('pt-BR')) {
      throw new BadRequestException('Para confirmar, digite o nome da empresa exatamente como está cadastrado.');
    }
    const counts = await this.counts(id);
    // Fotos no armazenamento: coletadas antes, apagadas depois que o banco confirmar a exclusão.
    const [answers, employees] = await Promise.all([
      this.prisma.checklistAnswer.findMany({ where: { tenantId: id, photoUrl: { not: null } }, select: { photoUrl: true } }),
      this.prisma.employee.findMany({ where: { tenantId: id, photoUrl: { not: null } }, select: { photoUrl: true } }),
    ]);
    const photos = [...answers, ...employees].map((row) => row.photoUrl).filter((url): url is string => !!url);

    await this.prisma.$transaction(async (tx) => {
      // Ordem explícita: registros que apontam para outros da mesma empresa saem primeiro.
      await tx.nonConformity.deleteMany({ where: { tenantId: id } });
      await tx.checklistAnswer.deleteMany({ where: { tenantId: id } });
      await tx.checklist.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });
    this.sessionCache.invalidateTenant(id);
    await this.audit(null, 'COMPANY_DELETED', actor, { id, name: company.name, code: company.code, cnpj: company.cnpj, counts });
    this.logger.warn(`DDS Master excluiu definitivamente a empresa "${company.name}" (${id}).`);

    let photosRemoved = 0;
    // Pasta inteira das fotos de inspeção (inclui fotos enviadas que nunca entraram numa inspeção).
    try {
      photosRemoved += await this.storage.deleteTenantChecklistPhotos(id);
    } catch (error) {
      this.logger.warn(`Pasta de fotos da empresa ${id} não removida: ${(error as Error).message}`);
    }
    // Fotos de crachá dos funcionários ficam numa pasta comum: uma a uma.
    for (const url of photos.filter((u) => !u.includes(`/checklist-photos/${id}/`))) {
      try {
        await this.storage.deleteFile(url);
        photosRemoved++;
      } catch (error) {
        this.logger.warn(`Foto não removida (${url}): ${(error as Error).message}`);
      }
    }
    return { deleted: true, name: company.name, counts, photosRemoved };
  }

  private async counts(id: string) {
    const [users, employees, vehicles, checklists, ncs, photos] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id } }),
      this.prisma.employee.count({ where: { tenantId: id } }),
      this.prisma.vehicle.count({ where: { tenantId: id } }),
      this.prisma.checklist.count({ where: { tenantId: id } }),
      this.prisma.nonConformity.count({ where: { tenantId: id } }),
      this.prisma.checklistAnswer.count({ where: { tenantId: id, photoUrl: { not: null } } }),
    ]);
    return { users, employees, vehicles, checklists, ncs, photos };
  }

  private assertNotArchived(row: CompanyRow): CompanyRow {
    if (row.archivedAt) throw new BadRequestException('Empresa arquivada. Restaure antes de alterar.');
    return row;
  }

  async history(tenantId?: string, limit = 100) {
    const logs = await this.prisma.masterAuditLog.findMany({
      where: tenantId ? { tenantId } : {},
      take: Math.min(Math.max(limit, 1), 200),
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, actor: true, details: true, createdAt: true, tenant: { select: { id: true, name: true } } },
    });
    return logs.map((log) => ({ ...log, details: log.details ? safeJson(log.details) : null }));
  }

  private view(row: CompanyRow, usage?: Usage) {
    const { masterNotes, ...rest } = row;
    const subscription: SubscriptionInfo = subscriptionInfo(row);
    return { ...rest, notes: masterNotes, subscription, usage: usage ?? EMPTY_USAGE };
  }

  private async findCompany(id: string): Promise<CompanyRow> {
    const platform = await this.platformTenantIds();
    const row = platform.has(id) ? null : await this.prisma.tenant.findUnique({ where: { id }, select: COMPANY_SELECT });
    if (!row) throw new NotFoundException('Empresa não encontrada no CHECK-ON.');
    return row;
  }

  /** Empresas que têm super admin: são a plataforma, não clientes. */
  private async platformTenantIds(): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<{ tenantId: string }[]>`
      SELECT DISTINCT u."tenantId" FROM "User" u JOIN "Role" r ON r.id = u."roleId" WHERE r.name = 'SUPER_ADMIN'`;
    return new Set(rows.map((r) => r.tenantId));
  }

  private async usageByTenant(onlyId?: string): Promise<Map<string, Usage>> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<UsageRow[]>`
      SELECT t.id,
        (SELECT count(*) FROM "User" u WHERE u."tenantId" = t.id AND u."isActive") AS users,
        (SELECT count(*) FROM "Employee" e WHERE e."tenantId" = t.id AND e."isActive") AS employees,
        (SELECT count(*) FROM "Vehicle" v WHERE v."tenantId" = t.id AND v."isActive") AS vehicles,
        (SELECT count(*) FROM "Checklist" c WHERE c."tenantId" = t.id AND c."completedAt" >= ${since}) AS "inspections30d",
        (SELECT max(c."completedAt") FROM "Checklist" c WHERE c."tenantId" = t.id) AS "lastInspectionAt",
        (SELECT count(*) FROM "NonConformity" n WHERE n."tenantId" = t.id AND n.status IN ('OPEN', 'IN_PROGRESS')) AS "openNcs"
      FROM "Tenant" t
      WHERE ${onlyId ?? null}::text IS NULL OR t.id = ${onlyId ?? null}`;
    return new Map(
      rows.map((r) => [
        r.id,
        {
          users: Number(r.users),
          employees: Number(r.employees),
          vehicles: Number(r.vehicles),
          inspections30d: Number(r.inspections30d),
          lastInspectionAt: r.lastInspectionAt ? new Date(r.lastInspectionAt).toISOString() : null,
          openNcs: Number(r.openNcs),
        },
      ]),
    );
  }

  private parseDate(value: string): Date {
    try {
      return endOfDayBrasilia(value);
    } catch {
      throw new BadRequestException('Data inválida.');
    }
  }

  private async audit(tenantId: string | null, action: string, actor: string | undefined, details: unknown) {
    await this.prisma.masterAuditLog.create({
      data: { tenantId, action, actor: actor?.slice(0, 160) || null, details: JSON.stringify(details).slice(0, 4000) },
    });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
