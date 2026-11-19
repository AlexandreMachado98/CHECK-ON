import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Quanto tempo a situação de um usuário/empresa fica em memória antes de ser consultada de novo. */
const TTL_MS = 30_000;

type TenantState = { isActive: boolean; sessionsRevokedAt: Date | null };
type UserState = { isActive: boolean; mustChangePassword: boolean; passwordChangedAt: Date | null };

/** Com senha provisória, o login só serve para trocar a senha (e consultar quem está logado / sair). */
const ALLOWED_WITH_TEMPORARY_PASSWORD = ['/auth/change-password', '/auth/me', '/auth/logout'];

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

  async assertValid(payload: { sub: string; tenantId: string; iat?: number; impersonatedBy?: string }, path = '') {
    const [user, tenant] = await Promise.all([this.user(payload.sub), this.tenant(payload.tenantId)]);
    if (!user || !user.isActive) throw new UnauthorizedException('Seu acesso foi bloqueado. Procure o administrador da sua empresa.');
    if (!tenant || !tenant.isActive) throw new UnauthorizedException('A empresa desta conta está desativada.');
    // "iat" do JWT é em segundos: compara no mesmo grão (token emitido no mesmo segundo da revogação cai).
    const issuedAt = payload.iat ?? 0;
    if (tenant.sessionsRevokedAt && issuedAt <= Math.floor(tenant.sessionsRevokedAt.getTime() / 1000)) {
      throw new UnauthorizedException('Sua sessão foi encerrada pelo administrador. Entre novamente.');
    }
    if (user.passwordChangedAt && issuedAt <= Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw new UnauthorizedException('Sua senha foi alterada. Entre novamente com a senha nova.');
    }
    const route = path.replace(/^\/api(?=\/)/, '').split('?')[0];
    if (user.mustChangePassword && !payload.impersonatedBy && !ALLOWED_WITH_TEMPORARY_PASSWORD.includes(route)) {
      throw new ForbiddenException({ statusCode: 403, message: 'Defina uma nova senha para continuar.', code: 'PASSWORD_CHANGE_REQUIRED' });
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
    const rows = await this.prisma.$queryRaw<UserState[]>`
      SELECT "isActive", "mustChangePassword", "passwordChangedAt" FROM "User" WHERE id = ${id}`;
    const value = rows[0] ?? null;
    this.users.set(id, { at: Date.now(), value });
    return value;
  }
}
