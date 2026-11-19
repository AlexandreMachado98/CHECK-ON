import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Login do aplicativo: código da empresa + matrícula (a matrícula faz o papel de senha). */
export class AppLoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsNotEmpty({ message: 'Informe o código da empresa.' })
  @IsString({ message: 'Informe o código da empresa.' })
  @MaxLength(20, { message: 'Código da empresa inválido.' })
  companyCode: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Informe a sua matrícula.' })
  @IsString({ message: 'Informe a sua matrícula.' })
  @MaxLength(40, { message: 'Matrícula inválida.' })
  matricula: string;
}
