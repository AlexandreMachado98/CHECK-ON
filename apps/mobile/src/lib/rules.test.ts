import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answersToSend, findVehicleByQr, matchesVehicle, messageFromBody, normalizeCompanyCode, parseNumber, pendingItems, VEHICLE_QR_PREFIX,
} from './rules.ts';

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id, text: `Item ${id}`, type: 'PASS_FAIL', isRequired: true, isCritical: false, photoRequirement: 'NONE', order: 0, ...extra,
});
const template = (items: ReturnType<typeof item>[]) => ({
  id: 't', name: 'Diário', description: null, version: 1, updatedAt: '', categories: [{ id: 'c', name: 'Geral', order: 0, items }],
});
const vehicle = (id: string, plate: string, extra: Record<string, unknown> = {}) => ({
  id, plate, prefix: null, brand: null, model: null, year: null, status: 'LIBERADO', mileage: null, qrCode: null, fleet: null, ...extra,
});

test('item obrigatório sem resposta fica pendente', () => {
  const t = template([item('a'), item('b', { isRequired: false })]);
  assert.deepEqual(pendingItems(t, {}).map((p) => p.itemId), ['a']);
  assert.equal(pendingItems(t, { a: { itemId: 'a', isCompliant: true } }).length, 0);
});

test('não conforme com foto exigida no problema pede foto', () => {
  const t = template([item('a', { photoRequirement: 'ON_NON_COMPLIANCE' })]);
  assert.equal(pendingItems(t, { a: { itemId: 'a', isCompliant: true } }).length, 0);
  const missing = pendingItems(t, { a: { itemId: 'a', isCompliant: false } });
  assert.equal(missing.length, 1);
  assert.match(missing[0].message, /foto do problema/);
  assert.equal(pendingItems(t, { a: { itemId: 'a', isCompliant: false, localPhotoUri: 'file:///x.jpg' } }).length, 0);
});

test('foto sempre exigida vale mesmo quando conforme', () => {
  const t = template([item('a', { photoRequirement: 'ALWAYS' })]);
  assert.equal(pendingItems(t, { a: { itemId: 'a', isCompliant: true } }).length, 1);
  assert.equal(pendingItems(t, { a: { itemId: 'a', isCompliant: true, photoUrl: 'https://x/y.jpg' } }).length, 0);
});

test('texto, número e foto contam como respondidos só com valor', () => {
  const t = template([item('t', { type: 'TEXT' }), item('n', { type: 'NUMBER' }), item('p', { type: 'PHOTO' })]);
  assert.equal(pendingItems(t, { t: { itemId: 't', textValue: '   ' }, n: { itemId: 'n' }, p: { itemId: 'p' } }).length, 3);
  assert.equal(
    pendingItems(t, { t: { itemId: 't', textValue: 'ok' }, n: { itemId: 'n', numberValue: 0 }, p: { itemId: 'p', localPhotoUri: 'file:///p.jpg' } }).length,
    0,
  );
});

test('answersToSend limpa campos vazios e ignora opcionais sem resposta', () => {
  const t = template([item('a'), item('b', { isRequired: false, type: 'TEXT' }), item('c', { type: 'NUMBER' })]);
  const sent = answersToSend(t, {
    a: { itemId: 'a', isCompliant: false, observations: '  pneu careca  ' },
    b: { itemId: 'b', textValue: ' ' },
    c: { itemId: 'c', numberValue: 12.5, textValue: 'lixo' },
  });
  assert.deepEqual(sent, [
    { itemId: 'a', isCompliant: false, observations: 'pneu careca' },
    { itemId: 'c', numberValue: 12.5 },
  ]);
});

test('parseNumber aceita vírgula e recusa texto', () => {
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber(' 100 '), 100);
  assert.equal(parseNumber('-3.2'), -3.2);
  assert.equal(parseNumber('12a'), undefined);
  assert.equal(parseNumber(''), undefined);
});

test('QR Code: aceita o do portal, o código cadastrado, a placa e o prefixo', () => {
  const vehicles = [vehicle('v1', 'ABC-1D23', { qrCode: 'QR-77' }), vehicle('v2', 'XYZ9876', { prefix: '1020' })];
  assert.equal(findVehicleByQr(vehicles, `${VEHICLE_QR_PREFIX}v2`)?.id, 'v2');
  assert.equal(findVehicleByQr(vehicles, 'checkon:veiculo:v1')?.id, 'v1');
  assert.equal(findVehicleByQr(vehicles, 'QR-77')?.id, 'v1');
  assert.equal(findVehicleByQr(vehicles, 'abc1d23')?.id, 'v1');
  assert.equal(findVehicleByQr(vehicles, '1020')?.id, 'v2');
  assert.equal(findVehicleByQr(vehicles, `${VEHICLE_QR_PREFIX}outro`), undefined);
  assert.equal(findVehicleByQr(vehicles, 'https://site-qualquer.com'), undefined);
});

test('busca de veículo por placa sem traço ou por modelo', () => {
  const v = vehicle('v1', 'ABC-1D23', { model: 'Atego 1719', fleet: { id: 'f', name: 'Leste' } });
  assert.ok(matchesVehicle(v, 'abc1'));
  assert.ok(matchesVehicle(v, 'atego'));
  assert.ok(matchesVehicle(v, 'leste'));
  assert.ok(!matchesVehicle(v, 'volvo'));
});

test('mensagens da API e código da empresa', () => {
  assert.equal(messageFromBody({ message: ['A', 'B'] }, 'x'), 'A\nB');
  assert.equal(messageFromBody({ message: 'Bloqueado' }, 'x'), 'Bloqueado');
  assert.equal(messageFromBody('<html>', 'x'), 'x');
  assert.equal(normalizeCompanyCode(' vistec ssqv '), 'VISTECSSQV');
});
