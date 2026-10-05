import { IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';

export class CreateFleetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  unitId: string;

}
