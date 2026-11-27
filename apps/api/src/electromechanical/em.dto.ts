import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateEmInspectionDto {
  @IsUUID()
  vehicleId: string;

  @IsDateString({}, { message: 'Informe a data em que a inspeção foi feita.' })
  performedAt: string;

  @IsDateString({}, { message: 'Informe a validade escrita no laudo.' })
  expiresAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reportNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photoUrl?: string;
}

/** Liberação provisória de veículo com a eletromecânica vencida. */
export class ReleaseEmDto {
  @IsDateString({}, { message: 'Informe até quando o veículo fica liberado.' })
  until: string;

  @IsString()
  @MinLength(10, { message: 'Explique por que o veículo pode circular (pelo menos 10 caracteres).' })
  @MaxLength(1000)
  reason: string;
}
