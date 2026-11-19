import { PlateField } from '../plate';
import { IsNotEmpty, IsOptional, IsBoolean, IsString, IsNumber } from 'class-validator';

export class CreateVehicleDto {
  @IsNotEmpty()
  @IsString()
  @PlateField()
  plate: string;

  @IsNotEmpty()
  @IsString()
  fleetId: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

}
