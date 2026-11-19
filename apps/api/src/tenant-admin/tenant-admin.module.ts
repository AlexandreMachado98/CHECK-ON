import { Module } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { TenantAdminController } from './tenant-admin.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TenantAdminController],
  providers: [TenantAdminService],
})
export class TenantAdminModule {}
