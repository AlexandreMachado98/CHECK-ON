import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ACTIONS, CATEGORY_KEYS, PRIORITIES } from './suggestion-rules';

/** Sugestão enviada pelo passageiro (página pública do QR). */
export class SubmitSuggestionDto {
  @IsIn(CATEGORY_KEYS, { message: 'Escolha o assunto da sugestão.' })
  category: string;

  @IsString()
  @MinLength(10, { message: 'Conte um pouco mais (pelo menos 10 caracteres).' })
  @MaxLength(1000, { message: 'A sugestão pode ter até 1.000 caracteres.' })
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'O contato pode ter até 120 caracteres.' })
  contact?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  deviceId?: string;
}

/** Nota do passageiro para a tratativa (link de acompanhamento). */
export class RateSuggestionDto {
  @Type(() => Number)
  @IsInt({ message: 'Escolha uma nota de 1 a 5.' })
  @Min(1, { message: 'Escolha uma nota de 1 a 5.' })
  @Max(5, { message: 'Escolha uma nota de 1 a 5.' })
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'O comentário pode ter até 500 caracteres.' })
  comment?: string;
}

/** Ação do gestor numa sugestão. */
export class HandleSuggestionDto {
  @IsIn(ACTIONS, { message: 'Ação inválida.' })
  action: (typeof ACTIONS)[number];

  @IsOptional()
  @IsIn(PRIORITIES, { message: 'Prioridade inválida.' })
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsDateString({}, { message: 'Prazo inválido.' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'A resposta pode ter até 2.000 caracteres.' })
  response?: string;
}
