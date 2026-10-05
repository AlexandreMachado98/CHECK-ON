import { IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateChecklistDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
