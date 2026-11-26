import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/** Uma linha da planilha, como veio (a conferência de cada campo é feita no serviço, linha a linha). */
export class ImportVehicleRowDto {
  @IsString() @MaxLength(20) plate: string;
  @IsString() @MaxLength(120) fleet: string;
  @IsOptional() @IsString() @MaxLength(60) prefix?: string;
  @IsOptional() @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @IsString() @MaxLength(10) year?: string;
}

export class ImportVehiclesDto {
  @IsArray()
  @ArrayMaxSize(2000, { message: 'Importe no máximo 2.000 veículos de cada vez.' })
  @ValidateNested({ each: true })
  @Type(() => ImportVehicleRowDto)
  rows: ImportVehicleRowDto[];

  /** true: só confere e devolve o resultado de cada linha, sem gravar nada. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
