import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Duas formas de entrar, no portal e no aplicativo:
 * - e-mail + senha;
 * - código da empresa + matrícula + senha (para quem não tem e-mail, como o motorista).
 */
export class LoginDto {
  @Transform(trimmed)
  @ValidateIf((dto: LoginDto) => !dto.companyCode && !dto.matricula)
  @IsEmail({}, { message: 'Informe um e-mail válido, ou o código da empresa e a matrícula.' })
  email?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @ValidateIf((dto: LoginDto) => !dto.email)
  @IsNotEmpty({ message: 'Informe o código da empresa.' })
  @IsString()
  @MaxLength(20)
  companyCode?: string;

  @Transform(trimmed)
  @ValidateIf((dto: LoginDto) => !dto.email)
  @IsNotEmpty({ message: 'Informe a matrícula.' })
  @IsString()
  @MaxLength(40)
  matricula?: string;

  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @IsString()
  @MaxLength(200)
  password: string;
}
