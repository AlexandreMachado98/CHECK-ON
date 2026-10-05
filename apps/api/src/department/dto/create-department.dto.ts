import { IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

}
