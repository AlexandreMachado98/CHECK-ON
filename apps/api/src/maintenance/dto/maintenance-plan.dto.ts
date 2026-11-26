import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateMaintenancePlanDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do plano (ex.: Troca de óleo).' })
  @MaxLength(80)
  name: string;

  @IsInt({ message: 'O intervalo em km deve ser um número inteiro.' })
  @Min(100, { message: 'O intervalo mínimo é de 100 km.' })
  @Max(1_000_000, { message: 'O intervalo máximo é de 1.000.000 km.' })
  intervalKm: number;

  /** Prazo também em dias (o que vencer primeiro). Vazio: só por km. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: 'O prazo em dias deve ser um número inteiro.' })
  @Min(1, { message: 'O prazo mínimo é de 1 dia.' })
  @Max(3650, { message: 'O prazo máximo é de 3.650 dias (10 anos).' })
  intervalDays?: number | null;

  @IsOptional()
  @IsInt({ message: 'O aviso antecipado deve ser um número inteiro de km.' })
  @Min(0)
  @Max(100_000, { message: 'O aviso antecipado máximo é de 100.000 km.' })
  warnBeforeKm?: number;

  /** Frota do plano. Vazio: vale para todos os veículos da empresa (só o administrador cria). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  fleetId?: string | null;
}

export class UpdateMaintenancePlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do plano (ex.: Troca de óleo).' })
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt({ message: 'O intervalo em km deve ser um número inteiro.' })
  @Min(100, { message: 'O intervalo mínimo é de 100 km.' })
  @Max(1_000_000, { message: 'O intervalo máximo é de 1.000.000 km.' })
  intervalKm?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: 'O prazo em dias deve ser um número inteiro.' })
  @Min(1, { message: 'O prazo mínimo é de 1 dia.' })
  @Max(3650, { message: 'O prazo máximo é de 3.650 dias (10 anos).' })
  intervalDays?: number | null;

  @IsOptional()
  @IsInt({ message: 'O aviso antecipado deve ser um número inteiro de km.' })
  @Min(0)
  @Max(100_000, { message: 'O aviso antecipado máximo é de 100.000 km.' })
  warnBeforeKm?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  fleetId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
