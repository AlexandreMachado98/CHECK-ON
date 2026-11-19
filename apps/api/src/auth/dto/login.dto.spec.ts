import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { ChangePasswordDto } from './change-password.dto';

async function messages(cls: new () => object, body: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body) as object);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

// Palavras das mensagens padrão (em inglês) do class-validator.
const ENGLISH = /\b(must|should|shorter|longer|string|empty|equal)\b/i;

describe('mensagens de validação do login em português', () => {
  const cases: Array<[string, unknown]> = [
    ['corpo vazio', {}],
    ['só a senha', { password: 'x' }],
    ['tipos errados', { companyCode: 123, matricula: false, password: 42 }],
    ['código e matrícula muito longos', { companyCode: 'X'.repeat(30), matricula: 'Y'.repeat(50), password: 'x' }],
    ['e-mail inválido', { email: 'nao-e-email', password: 'x' }],
  ];
  for (const [label, body] of cases) {
    it(label, async () => {
      const list = await messages(LoginDto, body);
      expect(list.length).toBeGreaterThan(0);
      for (const message of list) expect(message).not.toMatch(ENGLISH);
    });
  }

  it('login completo por matrícula não tem erro', async () => {
    expect(await messages(LoginDto, { companyCode: 'gama', matricula: 'M1', password: 'x' })).toEqual([]);
  });

  it('troca de senha: vazio e tipos errados também em português', async () => {
    for (const body of [{}, { currentPassword: 1, newPassword: 2 }, { currentPassword: 'a', newPassword: 'curta' }]) {
      for (const message of await messages(ChangePasswordDto, body)) expect(message).not.toMatch(ENGLISH);
    }
  });
});

import { createValidationPipe } from '../../common/validation';
describe('validação global', () => {
  it('campo não permitido vem em português', async () => {
    const pipe = createValidationPipe();
    const error = await pipe
      .transform({ email: 'a@b.com', password: 'x', extra: 1 }, { type: 'body', metatype: LoginDto })
      .catch((e: { getResponse: () => { message: string[] } }) => e.getResponse());
    expect((error as { message: string[] }).message).toEqual(['Campo não permitido: extra.']);
  });
});

describe('mensagens do login sem repetição', () => {
  it('login em branco: uma mensagem por campo, só "Informe..."', async () => {
    const error = await createValidationPipe()
      .transform({}, { type: 'body', metatype: LoginDto })
      .catch((e: { getResponse: () => { message: string[] } }) => e.getResponse());
    expect((error as { message: string[] }).message).toEqual([
      'Informe um e-mail válido, ou o código da empresa e a matrícula.',
      'Informe o código da empresa.',
      'Informe a matrícula.',
      'Informe a senha.',
    ]);
  });
  it('só faltou a matrícula', async () => {
    const error = await createValidationPipe()
      .transform({ companyCode: 'GAMA', password: 'x' }, { type: 'body', metatype: LoginDto })
      .catch((e: { getResponse: () => { message: string[] } }) => e.getResponse());
    expect((error as { message: string[] }).message).toEqual(['Informe a matrícula.']);
  });
});
