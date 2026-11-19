import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CompanyCodeField } from '../../company/company-code';
import { BILLING_CYCLES } from '../../subscription/subscription';

const onlyDigits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\D/g, '') || undefined : value);
const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Informe a data no formato AAAA-MM-DD.';
const CYCLE_MESSAGE = 'Ciclo de cobrança inválido (TESTE, MENSAL ou ANUAL).';

/** Novo cliente do CHECK-ON criado pelo DDS Master. */
export class CreateMasterCompanyDto {
  @Transform(trimmed)
  @IsNotEmpty({ message: 'Informe o nome da empresa.' })
  @IsString()
  @MaxLength(120)
  name: string;

  @Transform(onlyDigits)
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'O CNPJ precisa ter 14 dígitos.' })
  cnpj?: string;

  /** Código que os motoristas digitam no aplicativo. */
  @IsNotEmpty({ message: 'Informe o código de acesso do aplicativo.' })
  @CompanyCodeField()
  code: string;

  @IsIn(BILLING_CYCLES, { message: CYCLE_MESSAGE })
  billingCycle: string;

  /** Vencimento (AAAA-MM-DD). Sem ele: teste = hoje + trialDays; mensal = +1 mês; anual = +12 meses. */
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  subscriptionEndsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  graceDays?: number;

  @Transform(trimmed)
  @IsNotEmpty({ message: 'Informe o nome do administrador da empresa.' })
  @IsString()
  @MaxLength(120)
  adminName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido para o administrador.' })
  adminEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Alterações feitas na ficha do cliente. Campos ausentes não mudam. */
export class UpdateMasterCompanyDto {
  @Transform(trimmed)
  @IsOptional()
  @IsNotEmpty({ message: 'O nome da empresa não pode ficar vazio.' })
  @IsString()
  @MaxLength(120)
  name?: string;

  /** "" remove o CNPJ. */
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @Matches(/^\d{14}$/, { message: 'O CNPJ precisa ter 14 dígitos.' })
  cnpj?: string;

  @IsOptional()
  @CompanyCodeField()
  code?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES, { message: CYCLE_MESSAGE })
  billingCycle?: string;

  /** AAAA-MM-DD, ou null para "sem vencimento". */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE, { message: DATE_MESSAGE })
  subscriptionEndsAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  graceDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** false = suspender (bloqueio imediato); true = reativar. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Renovar: some meses a partir do vencimento atual (ou de hoje, se já venceu), ou defina a data. */
export class RenewMasterCompanyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  until?: string;

  @IsOptional()
  @IsIn(['MENSAL', 'ANUAL'], { message: 'Na renovação, o ciclo deve ser MENSAL ou ANUAL.' })
  billingCycle?: string;
}

export class ResetAdminPasswordDto {
  /** Administrador específico; sem ele, o primeiro administrador ativo da empresa. */
  @IsOptional()
  @IsString()
  userId?: string;
}

/** Confirmação de "Excluir definitivamente": o nome da empresa digitado. */
export class DeleteMasterCompanyDto {
  @IsString({ message: 'Digite o nome da empresa para confirmar.' })
  @IsNotEmpty({ message: 'Digite o nome da empresa para confirmar.' })
  @MaxLength(120)
  confirmName: string;
}
