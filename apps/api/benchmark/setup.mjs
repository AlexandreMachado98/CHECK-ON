// Monta a empresa do benchmark pela API (mesmo caminho do portal): 3 frentes, 6 frotas,
// 2 checklists (40 e 30 itens), 250 veículos/máquinas e 300 motoristas. Grava setup.json.
import { writeFileSync } from 'node:fs';
const BASE = process.env.API ?? 'http://localhost:3499';
async function call(method, path, token, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (res.status >= 400) { console.log('ERRO', method, path, res.status, JSON.stringify(data).slice(0, 300)); process.exit(1); }
  return data;
}
const superToken = (await call('POST', '/auth/login', null, { email: 'admin@checkon.com', password: 'admin123' })).access_token;
const code = 'FROTA250';
await call('POST', '/admin/tenants', superToken, { name: 'Mineradora Benchmark', code, adminName: 'Admin Bench', adminEmail: 'admin@bench.test', adminPassword: 'Provisoria123' });
let r = await call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'Provisoria123' });
if (r.user?.mustChangePassword || r.mustChangePassword) await call('POST', '/auth/change-password', r.access_token, { currentPassword: 'Provisoria123', newPassword: 'SenhaForte!2026' });
const admin = (await call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'SenhaForte!2026' })).access_token;

const units = await call('GET', '/units', admin);
const unitIds = [units[0].id];
await call('PATCH', `/units/${units[0].id}`, admin, { name: 'Contrato Mina Norte', client: 'Cliente Norte' });
unitIds.push((await call('POST', '/units', admin, { name: 'Contrato Porto', client: 'Cliente Porto' })).id);
unitIds.push((await call('POST', '/units', admin, { name: 'Obra Rodovia', client: 'Cliente Rodovia' })).id);
const fleets = [];
for (const [i, u] of unitIds.entries()) for (const kind of ['Caminhões', 'Máquinas']) fleets.push({ id: (await call('POST', '/fleets', admin, { name: `${kind} ${i + 1}`, unitId: u })).id, kind, unit: u });

async function template(name, sections, perSection) {
  const t = await call('POST', '/templates', admin, { name, allUnits: true });
  const items = [];
  for (let s = 0; s < sections; s++) {
    const cat = await call('POST', `/templates/${t.id}/categories`, admin, { name: `Seção ${s + 1}` });
    for (let k = 0; k < perSection; k++) {
      const n = s * perSection + k;
      const body = { text: `${name} · item ${n + 1}`, isCritical: n % 10 === 0, photoRequirement: n % 7 === 0 ? 'ON_NON_COMPLIANCE' : 'NONE' };
      if (n === sections * perSection - 1) body.type = 'NUMBER';
      const it = await call('POST', `/templates/categories/${cat.id}/items`, admin, body);
      items.push({ id: it.id, type: body.type ?? 'PASS_FAIL', critical: body.isCritical, text: body.text, category: `Seção ${s + 1}` });
    }
  }
  await call('PATCH', `/templates/${t.id}`, admin, { isActive: true });
  const full = await call('GET', `/templates/${t.id}`, admin);
  return { id: t.id, version: full.version, name, items };
}
const tplTruck = await template('Diário caminhão', 5, 8);
const tplMachine = await template('Diário máquina', 5, 6);

const vehicles = [];
for (let i = 0; i < 250; i++) {
  const f = fleets[i % fleets.length];
  const v = await call('POST', '/vehicles', admin, { plate: `BEN${String(i).padStart(4, '0')}`, fleetId: f.id, model: f.kind === 'Máquinas' ? 'Escavadeira' : 'Caminhão basculante', prefix: `P-${i + 1}` });
  vehicles.push({ id: v.id, unit: f.unit, template: f.kind === 'Máquinas' ? 'machine' : 'truck' });
}
const employees = [];
for (let i = 0; i < 300; i++) {
  const unit = unitIds[i % 3];
  const e = await call('POST', '/employees', admin, { name: `Motorista ${i + 1}`, matricula: `M${String(i + 1).padStart(4, '0')}`, unitIds: [unit] });
  employees.push({ id: e.id, matricula: `M${String(i + 1).padStart(4, '0')}`, unit });
}
writeFileSync('setup.json', JSON.stringify({ code, unitIds, fleets, tplTruck, tplMachine, vehicles, employees }, null, 1));
console.log('ok', { units: unitIds.length, fleets: fleets.length, vehicles: vehicles.length, employees: employees.length, itemsTruck: tplTruck.items.length, itemsMachine: tplMachine.items.length });
