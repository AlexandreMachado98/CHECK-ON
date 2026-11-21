import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { UNIT_SCOPE_KEY, UnitScope, seesAllUnits } from '../common/unit-scope';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // O JwtAuthGuard coloca o payload decodificado em req.user
    if (!user?.tenantId) return next.handle();
    this.cls.set('tenantId', user.tenantId);

    // Administrador vê todas as frentes de trabalho: sem escopo.
    if (seesAllUnits(user.role)) return next.handle();

    return from(this.resolveScope(user.id, user.tenantId, user.role)).pipe(
      switchMap((scope) => {
        this.cls.set(UNIT_SCOPE_KEY, scope);
        return next.handle();
      }),
    );
  }

  /**
   * Frentes que o login enxerga. Gestor e supervisor: vínculos do login. Motorista: vínculos do
   * funcionário dele. Só frentes ativas da mesma empresa. SQL direto: a consulta não pode passar
   * pelo próprio filtro que ela alimenta.
   */
  private async resolveScope(userId: string, tenantId: string, role: string): Promise<UnitScope> {
    const [account] = await this.prisma.$queryRaw<{ employeeId: string | null }[]>`
      SELECT "employeeId" FROM "User" WHERE "id" = ${userId} AND "tenantId" = ${tenantId}`;
    const employeeId = account?.employeeId ?? null;

    const rows =
      role === 'MOTORISTA'
        ? employeeId
          ? await this.prisma.$queryRaw<{ unitId: string }[]>`
              SELECT eu."unitId" FROM "EmployeeUnit" eu JOIN "Unit" u ON u."id" = eu."unitId"
              WHERE eu."employeeId" = ${employeeId} AND u."tenantId" = ${tenantId} AND u."isActive"`
          : []
        : await this.prisma.$queryRaw<{ unitId: string }[]>`
            SELECT uu."unitId" FROM "UserUnit" uu JOIN "Unit" u ON u."id" = uu."unitId"
            WHERE uu."userId" = ${userId} AND u."tenantId" = ${tenantId} AND u."isActive"`;

    return { unitIds: rows.map((row) => row.unitId), userId, employeeId };
  }
}
