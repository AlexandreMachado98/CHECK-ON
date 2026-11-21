import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class CreateUserDto {
  /** Frentes de trabalho que o gestor ou supervisor enxerga (ignorado para administrador e motorista). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsNotEmpty()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'A senha precisa ter pelo menos 8 caracteres.' })
  password: string;

  @IsNotEmpty()
  @IsString()
  roleId: string;

  /** Colaborador (funcionário) deste login. Obrigatório para o motorista registrar checklist no app. */
  @IsOptional()
  @IsString()
  employeeId?: string;
}
