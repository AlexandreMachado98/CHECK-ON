import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeTrainingDto } from './employee-training.dto';

export class CreateEmployeeDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  matricula?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  departmentName?: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string | null;

  @IsOptional()
  @IsDateString()
  companyIntegrationDate?: string | null;

  @IsOptional()
  @IsDateString()
  companyIntegrationExpiresAt?: string | null;

  @IsOptional()
  @IsDateString()
  clientIntegrationDate?: string | null;

  @IsOptional()
  @IsDateString()
  clientIntegrationExpiresAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EmployeeTrainingDto)
  trainings?: EmployeeTrainingDto[];
}
