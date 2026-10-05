import { Module } from '@nestjs/common';
import { NcService } from './nc.service';
import { NcController } from './nc.controller';

@Module({
  controllers: [NcController],
  providers: [NcService],
})
export class NcModule {}
