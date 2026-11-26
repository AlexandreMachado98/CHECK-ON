import { Module } from '@nestjs/common';
import { DrivingController } from './driving.controller';
import { PublicDrivingController } from './public-driving.controller';
import { DrivingService } from './driving.service';

@Module({
  controllers: [DrivingController, PublicDrivingController],
  providers: [DrivingService],
})
export class DrivingModule {}
