import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantAdminModule } from '../tenant-admin/tenant-admin.module';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { MasterTokenGuard } from './master-token.guard';

/** Integração com o DDS Master: assinatura, código do app e suspensão dos clientes do CHECK-ON. */
@Module({
  imports: [AuthModule, TenantAdminModule],
  controllers: [MasterController],
  providers: [MasterService, MasterTokenGuard],
})
export class MasterModule {}
