import { IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';

export class CreateUnitDto {
  @IsNotEmpty()
  @IsString()
  name: string;

}
