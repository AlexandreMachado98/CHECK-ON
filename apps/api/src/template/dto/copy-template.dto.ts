import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Copiar um modelo (para outra frente de trabalho): cria um modelo novo e independente. */
export class CopyTemplateDto {
  /** Nome da cópia. Sem nome: "<nome do original> (cópia)". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** A cópia vale em todas as frentes (só o administrador). */
  @IsOptional()
  @IsBoolean()
  allUnits?: boolean;

  /** Frentes em que a cópia vale. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];
}
