import { IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateFleetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
