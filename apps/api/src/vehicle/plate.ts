import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** Placa sem hífen, espaço ou minúscula: "abc-1d23" vira "ABC1D23". */
export function normalizePlate(value: unknown): unknown {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : value;
}

/** Placa brasileira: antiga (ABC1234) ou Mercosul (ABC1D23). */
export const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function PlateField(): PropertyDecorator {
  return (target, key) => {
    Transform(({ value }) => normalizePlate(value))(target, key);
    Matches(PLATE_PATTERN, { message: 'Placa inválida. Use o formato ABC1234 ou ABC1D23.' })(target, key);
  };
}
