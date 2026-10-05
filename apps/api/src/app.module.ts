import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantAdminModule } from './tenant-admin/tenant-admin.module';
import { UserModule } from './user/user.module';
import { UnitModule } from './unit/unit.module';
import { DepartmentModule } from './department/department.module';
import { EmployeeModule } from './employee/employee.module';
import { FleetModule } from './fleet/fleet.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { TemplateModule } from './template/template.module';
import { ChecklistModule } from './checklist/checklist.module';
import { NcModule } from './nc/nc.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StorageModule } from './storage/storage.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantInterceptor } from './tenant/tenant.interceptor';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    AuthModule,
    TenantAdminModule,
    UserModule,
    UnitModule,
    DepartmentModule,
    EmployeeModule,
    FleetModule,
    VehicleModule,
    TemplateModule,
    ChecklistModule,
    NcModule, DashboardModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
