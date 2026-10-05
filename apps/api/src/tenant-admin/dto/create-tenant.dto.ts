import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
