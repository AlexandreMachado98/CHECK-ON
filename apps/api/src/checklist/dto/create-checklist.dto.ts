import { IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';

export class CreateChecklistDto {
  @IsNotEmpty()
  @IsString()
  templateId: string;

  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  @IsNotEmpty()
  @IsString()
  driverId: string;

}
