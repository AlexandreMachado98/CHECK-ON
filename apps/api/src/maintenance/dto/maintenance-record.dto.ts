import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateMaintenanceRecordDto {
  @IsUUID()
  vehicleId: string;

  /** Plano atendido (reinicia o ciclo dele). Vazio: manutenção corretiva ou avulsa, com `title`. */
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsDateString({}, { message: 'Informe a data da manutenção.' })
  performedAt: string;

  @IsInt({ message: 'O km deve ser um número inteiro.' })
  @Min(0, { message: 'O km não pode ser negativo.' })
  @Max(9_999_999, { message: 'O km está alto demais. Confira o número.' })
  km: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workshop?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'O custo deve ser um valor com até 2 casas decimais.' })
  @Min(0, { message: 'O custo não pode ser negativo.' })
  @Max(9_999_999_999, { message: 'O custo está alto demais. Confira o valor.' })
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
