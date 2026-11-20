import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { resolve } from 'node:path';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { createValidationPipe } from './common/validation';
import { corsOrigins, isProduction, storageDriver, validateEnvOnStartup } from './config/env';

// O Prisma devolve BigInt (ex.: Tenant.storageUsed), que o JSON padrão não sabe serializar.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  validateEnvOnStartup();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Vercel Services forwards the public /api prefix to the Nest runtime.
  if (process.env.VERCEL === '1') app.setGlobalPrefix('api');
  app.set('trust proxy', 1); // atrás do proxy HTTPS do serviço de hospedagem
  app.disable('x-powered-by'); // não anuncia a tecnologia do servidor
  // Cabeçalhos de segurança básicos: a API só devolve JSON e fotos, nunca páginas para embutir.
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // fotos aparecem no portal e no app
    if (isProduction()) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.enableShutdownHooks();

  app.enableCors({ origin: corsOrigins(), credentials: true });

  if (storageDriver() === 'local') {
    const uploadsDirectory = resolve(process.env.UPLOADS_DIRECTORY || 'uploads');
    app.use('/uploads', express.static(uploadsDirectory, { dotfiles: 'deny', index: false, maxAge: '1d' }));
  }

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.useGlobalPipes(createValidationPipe());

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ouvindo na porta ${port} (${isProduction() ? 'produção' : 'desenvolvimento'}, storage ${storageDriver()})`);
}
bootstrap();
