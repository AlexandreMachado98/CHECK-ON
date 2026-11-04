import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { PHOTO_REQUIREMENTS } from '../../checklist/checklist-rules';

export const ITEM_TYPES = ['PASS_FAIL', 'TEXT', 'NUMBER', 'PHOTO'];

export class CreateTemplateItemDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  text: string;

  @IsOptional()
  @IsIn(ITEM_TYPES)
  type?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  /** Item crítico: resposta não conforme gera NC crítica e bloqueia o veículo. */
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  /** Exigir foto: NONE, ON_NON_COMPLIANCE (só quando não conforme) ou ALWAYS. */
  @IsOptional()
  @IsIn(PHOTO_REQUIREMENTS)
  photoRequirement?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateTemplateItemDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  text?: string;

  @IsOptional()
  @IsIn(ITEM_TYPES)
  type?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  /** Exigir foto: NONE, ON_NON_COMPLIANCE (só quando não conforme) ou ALWAYS. */
  @IsOptional()
  @IsIn(PHOTO_REQUIREMENTS)
  photoRequirement?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
