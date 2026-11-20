import { Prisma } from '@prisma/client';

/** Cliente mínimo (o PrismaService com a extensão de empresa serve: RateLimit não tem tenantId). */
type RawClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
};

/**
 * Limite de tentativas guardado no banco, valendo para todas as instâncias da API ao mesmo tempo.
 * Cada chave (ex.: "login-ip:1.2.3.4") conta dentro de uma janela; passada a janela, recomeça.
 */
export class RateLimiter {
  constructor(
    private readonly prisma: RawClient,
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private since(): Date {
    return new Date(Date.now() - this.windowMs);
  }

  /** Já estourou o limite nesta janela? Se o banco falhar, não bloqueia ninguém por isso. */
  async isBlocked(key: string): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`SELECT "count" FROM "RateLimit" WHERE "key" = ${key} AND "windowStart" > ${this.since()}`,
      );
      return (rows[0]?.count ?? 0) >= this.max;
    } catch {
      return false;
    }
  }

  /** Conta mais uma tentativa e devolve o total da janela. */
  async hit(key: string): Promise<number> {
    try {
      const now = new Date();
      const rows = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimit"."windowStart" <= ${this.since()} THEN 1 ELSE "RateLimit"."count" + 1 END,
          "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${this.since()} THEN ${now} ELSE "RateLimit"."windowStart" END
        RETURNING "count"`);
      // Limpeza de vez em quando: contadores com mais de um dia não servem para nada.
      if (Math.random() < 0.02) {
        await this.prisma.$executeRaw(Prisma.sql`DELETE FROM "RateLimit" WHERE "windowStart" < ${new Date(Date.now() - 86_400_000)}`);
      }
      return rows[0]?.count ?? 1;
    } catch {
      return 0;
    }
  }
}
