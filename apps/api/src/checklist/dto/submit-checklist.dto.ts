import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubmitAnswerDto {
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @IsOptional()
  @IsBoolean()
  isCompliant?: boolean;

  /** "Não se aplica" (o item não existe neste veículo). Em item crítico, exige observação. */
  @IsOptional()
  @IsBoolean()
  notApplicable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  textValue?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  numberValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;
}

export class SubmitChecklistDto {
  /** UUID gerado no celular. Garante que reenvios não dupliquem a execução. */
  @IsUUID('4')
  clientId: string;

  @IsNotEmpty()
  @IsString()
  templateId: string;

  /** Versão do modelo que o app usou (campo version do bootstrap). Sem ela, vale a versão atual. */
  @IsOptional()
  @IsInt()
  @Min(1)
  templateVersion?: number;

  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  /** Só gestores podem informar outro motorista; motoristas usam o próprio vínculo. */
  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsDateString()
  completedAt: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];

  /** Assinatura do colaborador (enviada antes por POST /checklists/photos, como as fotos). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  signatureUrl?: string;

  /** Nome de quem assinou, como aparece abaixo da assinatura. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  signedName?: string;

  /** Km do veículo (hodômetro) lido pelo motorista. */
  @IsOptional()
  @IsInt({ message: 'O km do veículo deve ser um número inteiro.' })
  @Min(0, { message: 'O km do veículo não pode ser negativo.' })
  @Max(9_999_999, { message: 'O km do veículo está alto demais. Confira o número.' })
  odometerKm?: number;
}

export class SyncChecklistsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmitChecklistDto)
  checklists: SubmitChecklistDto[];
}
