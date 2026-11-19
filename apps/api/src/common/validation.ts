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
      own = [constraints.isNotEmpty ?? constraints.isDefined];
    } else {
      own = Object.values(constraints);
    }
    return [...own, ...collect(error.children ?? [], path)];
  });
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
