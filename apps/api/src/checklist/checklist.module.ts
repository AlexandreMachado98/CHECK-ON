import { Module } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { ChecklistExecutionService } from './checklist-execution.service';
import { ChecklistController } from './checklist.controller';

@Module({
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistExecutionService],
  exports: [ChecklistExecutionService],
})
export class ChecklistModule {}
