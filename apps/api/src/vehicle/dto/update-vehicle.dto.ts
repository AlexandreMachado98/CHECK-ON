import { IsOptional, IsBoolean, IsString, IsNumber, IsIn } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  plate?: string;

  @IsOptional()
  @IsString()
  fleetId?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Ajuste manual do gestor. Não é possível liberar com NC crítica ativa. */
  @IsOptional()
  @IsIn(['LIBERADO', 'ATENCAO', 'BLOQUEADO'])
  status?: string;
}
