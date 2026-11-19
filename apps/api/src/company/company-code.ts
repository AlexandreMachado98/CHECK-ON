import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** Código da empresa no login por matrícula: 3 a 12 letras/números, sem espaço nem acento. */
export const COMPANY_CODE_PATTERN = /^[A-Z0-9]{3,12}$/;

export function CompanyCodeField(): PropertyDecorator {
  return (target, key) => {
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || undefined : value))(target, key);
    Matches(COMPANY_CODE_PATTERN, { message: 'O código da empresa deve ter de 3 a 12 letras ou números, sem espaço.' })(target, key);
  };
}

/** Sugestão a partir do nome: "Logística Gama" -> "LOGISTICAGA" (até 10). */
export function codeFromName(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return base.length >= 3 ? base : `${base}EMPRESA`.slice(0, 10);
}

/** Primeiro código livre: GAMA, GAMA2, GAMA3... */
export async function uniqueCompanyCode(name: string, isTaken: (code: string) => Promise<boolean>): Promise<string> {
  const base = codeFromName(name);
  for (let n = 1; n < 1000; n++) {
    const code = n === 1 ? base : `${base.slice(0, 9)}${n}`;
    if (!(await isTaken(code))) return code;
  }
  throw new Error('Não foi possível gerar um código para a empresa.');
}
