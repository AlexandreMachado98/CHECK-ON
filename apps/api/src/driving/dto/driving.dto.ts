import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DRIVING_TAG_KEYS, FEEDBACK_STATUSES } from '../driving-rules';

/** Avaliação enviada pelo passageiro (página pública, sem login). */
export class SubmitDrivingFeedbackDto {
  /** Inspeção do dia que identifica o motorista. Vazio: o passageiro não identificou. */
  @IsOptional()
  @IsUUID()
  checklistId?: string;

  @Type(() => Number)
  @IsInt({ message: 'Escolha uma nota de 1 a 5.' })
  @Min(1, { message: 'Escolha uma nota de 1 a 5.' })
  @Max(5, { message: 'Escolha uma nota de 1 a 5.' })
  rating: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DRIVING_TAG_KEYS.length)
  @IsIn(DRIVING_TAG_KEYS, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'O comentário pode ter até 1.000 caracteres.' })
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'O contato pode ter até 120 caracteres.' })
  contact?: string;

  /** Identificador aleatório guardado no navegador do passageiro (limite de repetição). */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  deviceId?: string;
}

/** Tratativa do gestor numa avaliação. */
export class TreatDrivingFeedbackDto {
  @IsIn(FEEDBACK_STATUSES, { message: 'Situação inválida.' })
  status: (typeof FEEDBACK_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'A tratativa pode ter até 2.000 caracteres.' })
  treatment?: string;
}

/** Gerar (ou trocar) o código do QR do passageiro de veículos. */
export class PassengerQrDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsUUID('all', { each: true })
  vehicleIds: string[];

  /** true: troca o código (os adesivos antigos param de valer). */
  @IsOptional()
  @IsBoolean()
  rotate?: boolean;
}
