import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PublicBadgeController } from './public-badge.controller';

@Module({
  controllers: [EmployeeController, PublicBadgeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
