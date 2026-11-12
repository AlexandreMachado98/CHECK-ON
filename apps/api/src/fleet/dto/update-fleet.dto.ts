import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateFleetDto {
  @Transform(trimmed)
  @IsOptional()
  @IsNotEmpty({ message: 'Informe o nome da frota.' })
  @IsString()
  @MaxLength(120)
  name?: string;

  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
