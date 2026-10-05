import { IsOptional, IsString } from 'class-validator';

export class UpdateNcDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
