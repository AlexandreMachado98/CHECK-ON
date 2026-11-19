import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

/** "Criar acesso" a partir de um colaborador: o perfil define onde ele entra (motorista = só aplicativo). */
export class CreateAccessDto {
  @IsNotEmpty({ message: 'Escolha o colaborador.' })
  @IsString()
  employeeId: string;

  @IsNotEmpty({ message: 'Escolha o perfil de acesso.' })
  @IsString()
  roleId: string;

  /** Opcional: com e-mail, a pessoa também pode entrar com ele. Sem, entra com código da empresa + matrícula. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || undefined : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsEmail({}, { message: 'Informe um e-mail válido ou deixe em branco.' })
  email?: string;
}
