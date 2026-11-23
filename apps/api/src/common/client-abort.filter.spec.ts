import { describe, expect, it } from 'vitest';
import { isClientAbort } from './client-abort.filter';

describe('Envio interrompido pelo aparelho', () => {
  it('reconhece a conexão que caiu no meio do upload (multer)', () => {
    expect(isClientAbort(new Error('Request aborted'))).toBe(true);
    expect(isClientAbort(new Error('Request closed'))).toBe(true);
  });

  it('outros erros seguem como erro do servidor', () => {
    expect(isClientAbort(new Error('Unexpected end of form'))).toBe(false);
    expect(isClientAbort(new Error('connect ECONNREFUSED'))).toBe(false);
    expect(isClientAbort('Request aborted')).toBe(false);
  });
});
