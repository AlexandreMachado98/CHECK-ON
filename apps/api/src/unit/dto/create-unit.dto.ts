import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUnitDto {
  /** Nome da frente de trabalho / contrato (ex.: "Contrato Mina Norte"). */
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  /** Cliente do contrato (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  client?: string | null;
}
