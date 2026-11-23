// Mede o envio de inspeções de 40 itens (com 1 item com problema) com o banco "longe" (via latency-proxy).
// Uso: node sync-latency.mjs  — 10 envios seguidos e depois 50 motoristas ao mesmo tempo.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const BASE = 'http://localhost:3499';
const S = JSON.parse(readFileSync('setup.json', 'utf8'));
const post = async (path, token, body) => { const t = performance.now(); const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); return { ms: performance.now() - t, data: await r.json() }; };
const insp = (vehicleId) => ({ clientId: randomUUID(), templateId: S.tplTruck.id, templateVersion: S.tplTruck.version, vehicleId, startedAt: new Date(Date.now() - 600000).toISOString(), completedAt: new Date().toISOString(), signedName: 'M',
  answers: S.tplTruck.items.map((it, k) => it.type === 'NUMBER' ? { itemId: it.id, numberValue: 1 } : { itemId: it.id, isCompliant: k !== 3 }) });
const trucks = (e) => S.vehicles.filter((v) => v.unit === e.unit && v.template === 'truck');
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; };
const e0 = S.employees[270];
const t0 = (await post('/auth/app-login', null, { companyCode: S.code, matricula: e0.matricula })).data.access_token;
const seq = [];
for (let i = 0; i < 10; i++) { const r = await post('/checklists/sync', t0, { checklists: [insp(trucks(e0)[i].id)] }); seq.push(r.ms); if (r.data.results[0].status !== 'CREATED') console.log('  falhou:', JSON.stringify(r.data).slice(0, 160)); }
console.log(`  1 motorista, 10 envios seguidos: p50 ${pct(seq, 50).toFixed(0)} ms, máx ${Math.max(...seq).toFixed(0)} ms`);
const emps = S.employees.slice(200, 250);
const tokens = await Promise.all(emps.map(async (e) => (await post('/auth/app-login', null, { companyCode: S.code, matricula: e.matricula })).data.access_token));
const rs = await Promise.all(emps.map((e, i) => post('/checklists/sync', tokens[i], { checklists: [insp(trucks(e)[5].id)] })));
const st = rs.map((r) => r.data.results?.[0]?.status ?? 'ERRO');
const count = st.reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
console.log(`  50 motoristas ao mesmo tempo: p50 ${pct(rs.map((r) => r.ms), 50).toFixed(0)} ms, p95 ${pct(rs.map((r) => r.ms), 95).toFixed(0)} ms · ${JSON.stringify(count)}`);
