import { Module } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { TenantAdminController } from './tenant-admin.controller';

@Module({
  controllers: [TenantAdminController],
  providers: [TenantAdminService],
})
export class TenantAdminModule {}
