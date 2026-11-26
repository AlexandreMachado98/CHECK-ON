import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/** Uma linha da planilha, como veio (a conferência de cada campo é feita no serviço, linha a linha). */
export class ImportEmployeeRowDto {
  @IsString() @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(60) matricula?: string;
  @IsOptional() @IsString() @MaxLength(60) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
  @IsOptional() @IsString() @MaxLength(20) admissionDate?: string;
  @IsOptional() @IsString() @MaxLength(500) units?: string;
}

export class ImportEmployeesDto {
  @IsArray()
  @ArrayMaxSize(2000, { message: 'Importe no máximo 2.000 colaboradores de cada vez.' })
  @ValidateNested({ each: true })
  @Type(() => ImportEmployeeRowDto)
  rows: ImportEmployeeRowDto[];

  /** true: só confere e devolve o resultado de cada linha, sem gravar nada. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
