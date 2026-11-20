import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NC_STATUSES } from '../../checklist/checklist-rules';
import { MAX_ACTION_PHOTOS } from '../nc-rules';

/** Registro da tratativa: o que foi feito, nova situação e/ou fotos. */
export class CreateNcActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsIn(NC_STATUSES, { message: 'Situação inválida.' })
  status?: string;

  /** Endereços devolvidos por POST /ncs/photos. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ACTION_PHOTOS, { message: `Anexe no máximo ${MAX_ACTION_PHOTOS} fotos por registro.` })
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  photoUrls?: string[];
}
