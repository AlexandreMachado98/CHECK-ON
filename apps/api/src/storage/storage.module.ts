import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StorageService } from './storage.service';
import { PhotosController } from './photos.controller';
import { PhotoUrlInterceptor } from './photo-url.interceptor';

@Global()
@Module({
  controllers: [PhotosController],
  providers: [StorageService, { provide: APP_INTERCEPTOR, useClass: PhotoUrlInterceptor }],
  exports: [StorageService],
})
export class StorageModule {}
