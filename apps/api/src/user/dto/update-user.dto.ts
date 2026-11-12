import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserDto {
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
