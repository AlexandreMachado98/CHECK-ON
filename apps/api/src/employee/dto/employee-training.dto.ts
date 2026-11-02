import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class EmployeeTrainingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsDateString()
  completedAt: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
