import { ArrayMaxSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTemplateDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Pede o km do veículo no checklist do app. */
  @IsOptional()
  @IsBoolean()
  askOdometer?: boolean;

  /** Vale em todas as frentes de trabalho. Falso: só nas frentes de unitIds. */
  @IsOptional()
  @IsBoolean()
  allUnits?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];
}
