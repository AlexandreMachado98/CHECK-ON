import { describe, expect, it } from 'vitest';
import { pickNeonAuthOrigin } from './neon-auth.client';

describe('Origin enviado ao Neon Auth', () => {
  it('nunca escolhe localhost quando há o domínio do painel (o caso da produção)', () => {
    expect(pickNeonAuthOrigin(undefined, ['http://localhost:3000', 'https://check-on-mu.vercel.app'])).toBe('https://check-on-mu.vercel.app');
  });
  it('NEON_AUTH_ORIGIN tem prioridade', () => {
    expect(pickNeonAuthOrigin('https://painel.empresa.com/', ['https://check-on-mu.vercel.app'])).toBe('https://painel.empresa.com');
  });
  it('desenvolvimento sem CORS_ORIGINS: localhost', () => {
    expect(pickNeonAuthOrigin(undefined, true)).toBe('http://localhost:3000');
  });
  it('só localhost na lista: usa o que houver', () => {
    expect(pickNeonAuthOrigin(undefined, ['http://localhost:3001'])).toBe('http://localhost:3001');
  });
});

import { normalizeOrigin } from './neon-auth.client';
describe('NEON_AUTH_ORIGIN digitado em outro formato', () => {
  it.each([
    ['check-on-mu.vercel.app', 'https://check-on-mu.vercel.app'],
    ['http://check-on-mu.vercel.app', 'https://check-on-mu.vercel.app'],
    [' https://check-on-mu.vercel.app/ ', 'https://check-on-mu.vercel.app'],
    ['https://check-on-mu.vercel.app/dashboard', 'https://check-on-mu.vercel.app'],
    ['http://localhost:3000', 'http://localhost:3000'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeOrigin(input)).toBe(expected);
  });
  it('valor que não é endereço cai no domínio público de CORS_ORIGINS', () => {
    expect(pickNeonAuthOrigin('???', ['http://localhost:3000', 'https://check-on-mu.vercel.app'])).toBe('https://check-on-mu.vercel.app');
  });
});
