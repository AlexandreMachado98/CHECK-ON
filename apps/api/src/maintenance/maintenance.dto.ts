import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class MaintenanceScheduleDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(9_999_999)
  intervalKm!: number;

  @IsInt()
  @Min(0)
  @Max(9_999_999)
  warningKm!: number;
}

export class CreateMaintenancePlanDto extends MaintenanceScheduleDto {
  @IsUUID()
  vehicleId!: string;

  @IsInt()
  @Min(0)
  @Max(9_999_999)
  baseKm!: number;
}

export class UpdateMaintenancePlanDto extends MaintenanceScheduleDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  baseKm?: number;
}

export class RecordMaintenanceDto {
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  mileageKm!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
