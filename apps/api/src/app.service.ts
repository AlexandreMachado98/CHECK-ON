import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  getInfo() {
    return { name: 'CHECK-ON API', status: 'ok' };
  }

  async health() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      this.logger.error('Falha no health check do banco', error as Error);
      return { status: 'error', database: 'unavailable' };
    }
  }
}
