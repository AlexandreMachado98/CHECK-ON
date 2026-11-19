import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

/** Junta as mensagens dos erros, inclusive de objetos aninhados (ex.: respostas de um checklist). */
function collect(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const constraints = error.constraints ?? {};
    let own: string[];
    if (constraints.whitelistValidation) {
      // Campo que a rota não aceita: a mensagem padrão vem em inglês ("property x should not exist").
      own = [`Campo não permitido: ${path}.`];
    } else if (constraints.isNotEmpty || constraints.isDefined) {
      // Campo em branco: só "Informe ...". As outras regras (tamanho, tipo) também falham e confundem.
      own = constraints.isNotEmpty
        ? [translate('isNotEmpty', constraints.isNotEmpty, path)]
        : [translate('isDefined', constraints.isDefined, path)];
    } else {
      own = Object.entries(constraints).map(([rule, message]) => translate(rule, message, path));
    }
    return [...own, ...collect(error.children ?? [], path)];
  });
}

/**
 * Mensagens padrão do class-validator vêm em inglês ("clientId must be a UUID").
 * As que já têm texto próprio em português passam direto; as em inglês são traduzidas pela regra.
 */
const TRANSLATIONS: Record<string, (field: string) => string> = {
  isNotEmpty: (f) => `Informe o campo ${f}.`,
  isDefined: (f) => `Informe o campo ${f}.`,
  isString: (f) => `O campo ${f} deve ser um texto.`,
  isUuid: (f) => `O campo ${f} tem um identificador inválido.`,
  isInt: (f) => `O campo ${f} deve ser um número inteiro.`,
  isNumber: (f) => `O campo ${f} deve ser um número.`,
  isBoolean: (f) => `O campo ${f} deve ser verdadeiro ou falso.`,
  isDateString: (f) => `O campo ${f} deve ser uma data válida.`,
  isIso8601: (f) => `O campo ${f} deve ser uma data válida.`,
  isArray: (f) => `O campo ${f} deve ser uma lista.`,
  arrayMaxSize: (f) => `O campo ${f} tem itens demais.`,
  arrayMinSize: (f) => `O campo ${f} precisa de pelo menos um item.`,
  arrayNotEmpty: (f) => `O campo ${f} precisa de pelo menos um item.`,
  min: (f) => `O campo ${f} está abaixo do mínimo permitido.`,
  max: (f) => `O campo ${f} está acima do máximo permitido.`,
  minLength: (f) => `O campo ${f} está curto demais.`,
  maxLength: (f) => `O campo ${f} está longo demais.`,
  isIn: (f) => `O campo ${f} tem um valor não permitido.`,
  isEnum: (f) => `O campo ${f} tem um valor não permitido.`,
  isEmail: (f) => `O campo ${f} deve ser um e-mail válido.`,
  matches: (f) => `O campo ${f} está em um formato inválido.`,
  isLatitude: () => 'Latitude inválida.',
  isLongitude: () => 'Longitude inválida.',
  isUrl: (f) => `O campo ${f} deve ser um endereço (URL) válido.`,
  nestedValidation: (f) => `O campo ${f} está em um formato inválido.`,
};

const ENGLISH_DEFAULT = /\b(must|should|shorter|longer|each value)\b/i;

function translate(rule: string, message: string, path: string): string {
  if (!ENGLISH_DEFAULT.test(message)) return message;
  return TRANSLATIONS[rule]?.(path) ?? `O campo ${path} é inválido.`;
}

/** Mensagens únicas, na ordem em que apareceram. */
function unique(messages: string[]): string[] {
  return [...new Set(messages)];
}

/** Validação global: só os campos esperados, convertidos para os tipos certos, com mensagens em português. */
export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({ statusCode: 400, message: unique(collect(errors)), error: 'Bad Request' }),
  });
}
