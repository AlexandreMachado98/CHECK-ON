import { describe, expect, it } from 'vitest';
import { resolutionError } from './nc-rules';

describe('regras para resolver uma NC', () => {
  const base = { fromStatus: 'IN_PROGRESS', severity: 'MEDIUM', text: 'pneu trocado', hasTreatmentPhoto: false };

  it('resolver exige descrever o que foi feito', () => {
    expect(resolutionError({ ...base, toStatus: 'RESOLVED', text: '  ' })).toBe('Para resolver a NC, descreva o que foi feito.');
    expect(resolutionError({ ...base, toStatus: 'CLOSED', text: null })).toBe('Para resolver a NC, descreva o que foi feito.');
    expect(resolutionError({ ...base, toStatus: 'RESOLVED' })).toBeNull();
  });
  it('NC crítica exige foto da correção (deste registro ou de um anterior)', () => {
    expect(resolutionError({ ...base, severity: 'CRITICAL', toStatus: 'RESOLVED' })).toBe('NC crítica: anexe ao menos uma foto da correção para resolver.');
    expect(resolutionError({ ...base, severity: 'CRITICAL', toStatus: 'RESOLVED', hasTreatmentPhoto: true })).toBeNull();
  });
  it('NC não crítica resolve sem foto', () => {
    expect(resolutionError({ ...base, severity: 'HIGH', toStatus: 'RESOLVED' })).toBeNull();
  });
  it('comentar ou mudar para "em tratamento" não exige nada', () => {
    expect(resolutionError({ ...base, severity: 'CRITICAL', toStatus: 'IN_PROGRESS', text: null })).toBeNull();
    expect(resolutionError({ ...base, severity: 'CRITICAL', toStatus: null, text: null })).toBeNull();
  });
  it('encerrar uma NC que já estava resolvida não repete a exigência', () => {
    expect(resolutionError({ ...base, fromStatus: 'RESOLVED', severity: 'CRITICAL', toStatus: 'CLOSED', text: null })).toBeNull();
  });
});
