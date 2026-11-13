import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' && !value.trim() ? null : typeof value === 'string' ? value.trim() : value);

export class UpdateCompanyDto {
  @Transform(trimmed)
  @IsOptional()
  @IsNotEmpty({ message: 'Informe o nome da empresa.' })
  @IsString()
  @MaxLength(120)
  name?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') || null : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\d{14}$/, { message: 'O CNPJ precisa ter 14 dígitos.' })
  cnpj?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'Informe um e-mail de contato válido.' })
  contactEmail?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  autoBlockCriticalNc?: boolean;
}
