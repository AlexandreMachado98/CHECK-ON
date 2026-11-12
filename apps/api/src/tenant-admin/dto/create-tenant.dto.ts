import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const TENANT_PLANS = ['STARTER', 'PRO', 'ENTERPRISE'] as const;

const onlyDigits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') || undefined : value;
const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTenantDto {
  @Transform(trimmed)
  @IsNotEmpty({ message: 'Informe o nome da empresa.' })
  @IsString()
  @MaxLength(120)
  name: string;

  @Transform(onlyDigits)
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'O CNPJ precisa ter 14 dígitos.' })
  cnpj?: string;

  @IsOptional()
  @IsIn(TENANT_PLANS, { message: 'Plano inválido.' })
  plan?: string;

  // Primeiro usuário da empresa: o administrador que cadastra os demais.
  @Transform(trimmed)
  @IsNotEmpty({ message: 'Informe o nome do administrador.' })
  @IsString()
  @MaxLength(120)
  adminName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido para o administrador.' })
  adminEmail: string;

  @IsString()
  @MinLength(8, { message: 'A senha do administrador precisa ter pelo menos 8 caracteres.' })
  adminPassword: string;
}
