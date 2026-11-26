import { Module } from '@nestjs/common';
import { ElectromechanicalController } from './em.controller';
import { ElectromechanicalService } from './em.service';

@Module({
  controllers: [ElectromechanicalController],
  providers: [ElectromechanicalService],
})
export class ElectromechanicalModule {}
