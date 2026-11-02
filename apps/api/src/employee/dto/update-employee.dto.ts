import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeTrainingDto } from './employee-training.dto';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  matricula?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string | null;

  @IsOptional()
  @IsString()
  departmentName?: string | null;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
