import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    prisma.$queryRaw.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    appController = app.get<AppController>(AppController);
  });

  it('responde com a identificação da API', () => {
    expect(appController.getInfo()).toEqual({ name: 'CHECK-ON API', status: 'ok' });
  });

  it('health retorna ok quando o banco responde', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(appController.health()).resolves.toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('health retorna 503 quando o banco não responde', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    await expect(appController.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
