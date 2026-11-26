import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/** Uma linha da planilha, como veio (a conferência é feita no serviço, linha a linha). */
export class ImportFleetRowDto {
  @IsString() @MaxLength(120) fleet: string;
  @IsOptional() @IsString() @MaxLength(120) unit?: string;
  @IsOptional() @IsString() @MaxLength(120) client?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class ImportFleetsDto {
  @IsArray()
  @ArrayMaxSize(1000, { message: 'Importe no máximo 1.000 frotas de cada vez.' })
  @ValidateNested({ each: true })
  @Type(() => ImportFleetRowDto)
  rows: ImportFleetRowDto[];

  /** true: só confere e devolve o resultado de cada linha, sem gravar nada. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
