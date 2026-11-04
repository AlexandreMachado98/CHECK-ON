import {
  canTransitionNc,
  photoIsRequired,
  escalateVehicleStatus,
  maxSeverity,
  severityFor,
  validateAnswers,
  validateTimestamps,
  itemsForVersion,
  vehicleStatusFromActiveNcs,
  RuleItem,
} from './checklist-rules';

const items: RuleItem[] = [
  { id: 'pneu', text: 'Pneus em bom estado', type: 'PASS_FAIL', isRequired: true, isCritical: true },
  { id: 'km', text: 'Quilometragem', type: 'NUMBER', isRequired: true, isCritical: false },
  { id: 'obs', text: 'Observações gerais', type: 'TEXT', isRequired: false, isCritical: false },
  { id: 'foto', text: 'Foto do painel', type: 'PHOTO', isRequired: false, isCritical: false },
];

describe('validateAnswers', () => {
  it('aceita respostas completas e normaliza valores', () => {
    const { errors, answers } = validateAnswers(items, [
      { itemId: 'pneu', isCompliant: true },
      { itemId: 'km', numberValue: 120500 },
      { itemId: 'obs', textValue: '  tudo certo  ' },
    ]);
    expect(errors).toEqual([]);
    expect(answers).toHaveLength(3);
    expect(answers.find((a) => a.itemId === 'km')?.isCompliant).toBe(true);
    expect(answers.find((a) => a.itemId === 'obs')?.textValue).toBe('tudo certo');
  });

  it('aponta item obrigatório ausente ou sem valor', () => {
    const { errors } = validateAnswers(items, [{ itemId: 'km' }]);
    expect(errors).toHaveLength(2);
    expect(errors.join(' ')).toContain('Quilometragem');
    expect(errors.join(' ')).toContain('Pneus em bom estado');
  });

  it('rejeita item de outro template e resposta duplicada', () => {
    const { errors } = validateAnswers(items, [
      { itemId: 'pneu', isCompliant: true },
      { itemId: 'pneu', isCompliant: false },
      { itemId: 'km', numberValue: 1 },
      { itemId: 'intruso', isCompliant: true },
    ]);
    expect(errors).toHaveLength(2);
  });

  it('ignora opcional vazio, mas guarda opcional marcado como não conforme', () => {
    const { errors, answers } = validateAnswers(items, [
      { itemId: 'pneu', isCompliant: false },
      { itemId: 'km', numberValue: 10 },
      { itemId: 'obs' },
      { itemId: 'foto', isCompliant: false, observations: 'Câmera quebrada' },
    ]);
    expect(errors).toEqual([]);
    expect(answers.map((a) => a.itemId)).toEqual(['pneu', 'km', 'foto']);
    expect(answers.find((a) => a.itemId === 'foto')?.isCompliant).toBe(false);
  });
});

describe('validateTimestamps', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  it('aceita pequena diferença de relógio', () => {
    expect(validateTimestamps(new Date('2026-11-04T11:00:00Z'), new Date('2026-11-04T12:03:00Z'), now)).toEqual([]);
  });
  it('rejeita conclusão no futuro e início depois da conclusão', () => {
    expect(validateTimestamps(new Date('2026-11-04T13:00:00Z'), new Date('2026-11-04T12:30:00Z'), now)).toHaveLength(2);
  });
});

describe('severidade e status do veículo', () => {
  it('item crítico gera NC crítica', () => {
    expect(severityFor({ isCritical: true })).toBe('CRITICAL');
    expect(severityFor({ isCritical: false })).toBe('MEDIUM');
    expect(maxSeverity('MEDIUM', 'CRITICAL')).toBe('CRITICAL');
    expect(maxSeverity('CRITICAL', 'MEDIUM')).toBe('CRITICAL');
  });

  it('calcula status pelas NCs ativas', () => {
    expect(vehicleStatusFromActiveNcs([])).toBe('LIBERADO');
    expect(vehicleStatusFromActiveNcs(['MEDIUM'])).toBe('ATENCAO');
    expect(vehicleStatusFromActiveNcs(['MEDIUM', 'CRITICAL'])).toBe('BLOQUEADO');
  });

  it('checklist nunca libera um veículo bloqueado', () => {
    expect(escalateVehicleStatus('BLOQUEADO', 'LIBERADO')).toBe('BLOQUEADO');
    expect(escalateVehicleStatus('LIBERADO', 'ATENCAO')).toBe('ATENCAO');
  });
});

describe('canTransitionNc', () => {
  it('impede reabrir NC encerrada', () => {
    expect(canTransitionNc('CLOSED', 'OPEN')).toBe(false);
    expect(canTransitionNc('CLOSED', 'CLOSED')).toBe(true);
    expect(canTransitionNc('RESOLVED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionNc('OPEN', 'INVALIDO')).toBe(false);
  });
});

describe('foto obrigatória', () => {
  const pneu: RuleItem = { id: 'pneu', text: 'Pneus', type: 'PASS_FAIL', isRequired: true, isCritical: true, photoRequirement: 'ON_NON_COMPLIANCE' };
  const painel: RuleItem = { id: 'painel', text: 'Painel', type: 'NUMBER', isRequired: true, isCritical: false, photoRequirement: 'ALWAYS' };

  it('só exige foto do item não conforme quando configurado assim', () => {
    expect(photoIsRequired(pneu, true)).toBe(false);
    expect(photoIsRequired(pneu, false)).toBe(true);
    expect(photoIsRequired(painel, true)).toBe(true);
    expect(photoIsRequired({ ...pneu, photoRequirement: 'NONE' }, false)).toBe(false);
    expect(photoIsRequired({ ...pneu, type: 'PHOTO', photoRequirement: 'ALWAYS' }, true)).toBe(false);
  });

  it('recusa não conforme sem foto e aceita com foto', () => {
    const semFoto = validateAnswers([pneu], [{ itemId: 'pneu', isCompliant: false }]);
    expect(semFoto.errors).toHaveLength(1);
    expect(semFoto.errors[0]).toContain('exige foto');
    const comFoto = validateAnswers([pneu], [{ itemId: 'pneu', isCompliant: false, photoUrl: 'http://x/foto.jpg' }]);
    expect(comFoto.errors).toEqual([]);
    expect(comFoto.answers[0].photoUrl).toBe('http://x/foto.jpg');
    expect(validateAnswers([pneu], [{ itemId: 'pneu', isCompliant: true }]).errors).toEqual([]);
  });

  it('exige foto sempre quando configurado como ALWAYS', () => {
    expect(validateAnswers([painel], [{ itemId: 'painel', numberValue: 1000 }]).errors).toHaveLength(1);
    expect(validateAnswers([painel], [{ itemId: 'painel', numberValue: 1000, photoUrl: 'http://x/p.jpg' }]).errors).toEqual([]);
  });
});

describe('itemsForVersion', () => {
  const base = { text: 'x', type: 'PASS_FAIL', isRequired: true, isCritical: false };
  const items = [
    { ...base, id: 'a', isActive: true, addedInVersion: 1 },
    { ...base, id: 'b', isActive: true, addedInVersion: 4 },
    { ...base, id: 'c', isActive: false, addedInVersion: 1 },
  ];

  it('mantém obrigatório só o que existia e continua ativo', () => {
    const result = itemsForVersion(items, 3);
    expect(result.map((i) => [i.id, i.isRequired])).toEqual([['a', true], ['b', false], ['c', false]]);
  });

  it('na versão do item novo, ele passa a ser obrigatório', () => {
    expect(itemsForVersion(items, 4).find((i) => i.id === 'b')?.isRequired).toBe(true);
  });

  it('não altera os itens originais', () => {
    itemsForVersion(items, 1);
    expect(items[1].isRequired).toBe(true);
  });
});
