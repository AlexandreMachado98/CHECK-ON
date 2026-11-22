import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class UpdateUserDto {
  /** Frentes de trabalho que o gestor ou supervisor enxerga (ignorado para administrador e motorista). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'A senha precisa ter pelo menos 8 caracteres.' })
  password?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Colaborador vinculado. null desfaz o vínculo. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  employeeId?: string | null;
}
