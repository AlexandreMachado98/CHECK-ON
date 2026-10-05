import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('✅ NestJS Dependency Injection graph initialized successfully!');
  await app.close();
}
bootstrap().catch(console.error);
