import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUnitDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  client?: string | null;

  /** Frente desativada: gestores, supervisores e motoristas deixam de ver os dados dela. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
