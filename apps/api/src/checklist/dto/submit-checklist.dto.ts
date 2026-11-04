import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SubmitAnswerDto {
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @IsOptional()
  @IsBoolean()
  isCompliant?: boolean;

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
}

export class SyncChecklistsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmitChecklistDto)
  checklists: SubmitChecklistDto[];
}
