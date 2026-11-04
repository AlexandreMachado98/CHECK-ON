import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { resolve } from 'node:path';
import { corsOrigins, isProduction, storageDriver, validateEnvOnStartup } from './config/env';

// O Prisma devolve BigInt (ex.: Tenant.storageUsed), que o JSON padrão não sabe serializar.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  validateEnvOnStartup();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // atrás do proxy HTTPS do serviço de hospedagem
  app.enableShutdownHooks();

  app.enableCors({ origin: corsOrigins(), credentials: true });

  if (storageDriver() === 'local') {
    const uploadsDirectory = resolve(process.env.UPLOADS_DIRECTORY || 'uploads');
    app.use('/uploads', express.static(uploadsDirectory, { dotfiles: 'deny', index: false, maxAge: '1d' }));
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ouvindo na porta ${port} (${isProduction() ? 'produção' : 'desenvolvimento'}, storage ${storageDriver()})`);
}
bootstrap();
