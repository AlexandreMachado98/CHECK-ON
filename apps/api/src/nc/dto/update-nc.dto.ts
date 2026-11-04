import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NC_STATUSES } from '../../checklist/checklist-rules';

export class UpdateNcDto {
  @IsOptional()
  @IsIn(NC_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
