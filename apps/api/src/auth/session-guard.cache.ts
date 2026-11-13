import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Quanto tempo a situação de um usuário/empresa fica em memória antes de ser consultada de novo. */
const TTL_MS = 30_000;

type TenantState = { isActive: boolean; sessionsRevokedAt: Date | null };
type UserState = { isActive: boolean };

/**
 * Confere a cada requisição se o login ainda vale, sem esperar o token expirar (1 dia):
 * usuário bloqueado, empresa desativada ou "Revogar todas as sessões" derrubam o acesso
 * em até 30 segundos (na hora, na instância que fez a alteração).
 */
@Injectable()
export class SessionGuardCache {
  private readonly tenants = new Map<string, { at: number; value: TenantState | null }>();
  private readonly users = new Map<string, { at: number; value: UserState | null }>();

  constructor(private readonly prisma: PrismaService) {}

  async assertValid(payload: { sub: string; tenantId: string; iat?: number }) {
    const [user, tenant] = await Promise.all([this.user(payload.sub), this.tenant(payload.tenantId)]);
    if (!user || !user.isActive) throw new UnauthorizedException('Seu acesso foi bloqueado. Procure o administrador da sua empresa.');
    if (!tenant || !tenant.isActive) throw new UnauthorizedException('A empresa desta conta está desativada.');
    if (tenant.sessionsRevokedAt && payload.iat && payload.iat * 1000 < tenant.sessionsRevokedAt.getTime()) {
      throw new UnauthorizedException('Sua sessão foi encerrada pelo administrador. Entre novamente.');
    }
  }

  invalidateTenant(tenantId: string) {
    this.tenants.delete(tenantId);
  }

  invalidateUser(userId: string) {
    this.users.delete(userId);
  }

  // SQL direto: aqui ainda não há empresa no contexto, e a consulta não deve depender do filtro de tenant.
  private async tenant(id: string): Promise<TenantState | null> {
    const hit = this.tenants.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const rows = await this.prisma.$queryRaw<TenantState[]>`SELECT "isActive", "sessionsRevokedAt" FROM "Tenant" WHERE id = ${id}`;
    const value = rows[0] ?? null;
    this.tenants.set(id, { at: Date.now(), value });
    return value;
  }

  private async user(id: string): Promise<UserState | null> {
    const hit = this.users.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const rows = await this.prisma.$queryRaw<UserState[]>`SELECT "isActive" FROM "User" WHERE id = ${id}`;
    const value = rows[0] ?? null;
    this.users.set(id, { at: Date.now(), value });
    return value;
  }
}
