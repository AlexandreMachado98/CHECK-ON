import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TENANT_PLANS } from './create-tenant.dto';

export class UpdateTenantDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(TENANT_PLANS, { message: 'Plano inválido.' })
  plan?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
