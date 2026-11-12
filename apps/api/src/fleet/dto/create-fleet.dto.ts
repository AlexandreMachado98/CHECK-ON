import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFleetDto {
  @Transform(trimmed)
  @IsNotEmpty({ message: 'Informe o nome da frota.' })
  @IsString()
  @MaxLength(120)
  name: string;

  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Unidade da frota. Sem ela, a frota vai para a "Unidade principal" da empresa. */
  @IsOptional()
  @IsString()
  unitId?: string;
}
