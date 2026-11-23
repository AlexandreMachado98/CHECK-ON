// Benchmark da API do CHECK-ON contra a massa de 250 veículos (setup.json + history.sql).
// Uso: node bench.mjs [fase...]   fases: latencia pico portal duplicado   (sem argumento: todas)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const BASE = process.env.API ?? 'http://localhost:3499';
const S = JSON.parse(readFileSync('setup.json', 'utf8'));
const phases = process.argv.slice(2).length ? process.argv.slice(2) : ['latencia', 'pico', 'portal', 'duplicado'];
const results = {};

async function call(method, path, token, body) {
  const t0 = performance.now();
  let status = 0, size = 0, data = null;
  try {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); status = res.status; size = Buffer.byteLength(text);
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  } catch (e) { data = String(e); }
  return { ms: performance.now() - t0, status, size, data };
}
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0; };
function summary(name, samples) {
  const ms = samples.map((s) => s.ms), errors = samples.filter((s) => s.status < 200 || s.status >= 300);
  const r = { n: samples.length, p50: +pct(ms, 50).toFixed(1), p95: +pct(ms, 95).toFixed(1), p99: +pct(ms, 99).toFixed(1), max: +Math.max(...ms).toFixed(1), erros: errors.length, kb: +(samples.reduce((a, s) => a + s.size, 0) / samples.length / 1024).toFixed(1) };
  if (errors.length) r.exemploErro = `${errors[0].status} ${JSON.stringify(errors[0].data).slice(0, 160)}`;
  console.log(`  ${name.padEnd(42)} n=${String(r.n).padStart(4)}  p50=${String(r.p50).padStart(7)}ms  p95=${String(r.p95).padStart(7)}ms  p99=${String(r.p99).padStart(7)}ms  max=${String(r.max).padStart(7)}ms  erros=${r.erros}  ${r.kb}KB`);
  if (r.exemploErro) console.log(`     erro: ${r.exemploErro}`);
  return r;
}
async function pool(n, jobs) { // roda jobs (funções) com n ao mesmo tempo
  let i = 0; const out = [];
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
  return out;
}
function inspection(vehicle, failSome = true) {
  const tpl = vehicle.template === 'machine' ? S.tplMachine : S.tplTruck;
  const now = new Date();
  return {
    clientId: randomUUID(), templateId: tpl.id, templateVersion: tpl.version, vehicleId: vehicle.id,
    startedAt: new Date(now - 600_000).toISOString(), completedAt: now.toISOString(), signedName: 'Motorista',
    answers: tpl.items.map((it, k) => it.type === 'NUMBER' ? { itemId: it.id, numberValue: 123456 }
      : { itemId: it.id, isCompliant: !(failSome && k === 3), ...(failSome && k === 3 ? { observations: 'Problema encontrado no teste' } : {}) }),
  };
}
const adminLogin = async () => (await call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'SenhaForte!2026' })).data.access_token;
const driverLogin = async (e) => (await call('POST', '/auth/app-login', null, { companyCode: S.code, matricula: e.matricula })).data?.access_token;
const vehicleOf = (e, k = 0) => { const vs = S.vehicles.filter((v) => v.unit === e.unit); return vs[(S.employees.indexOf(e) + k) % vs.length]; };

if (phases.includes('latencia')) {
  console.log('\n== 1. Tempo de resposta com 1 pessoa usando (30 repetições) ==');
  const admin = await adminLogin();
  const e = S.employees[0]; const driver = await driverLogin(e);
  const list = (await call('GET', '/checklists?pageSize=50', admin)).data;
  const someId = list.items[0].id;
  const nc = (await call('GET', '/ncs?status=ACTIVE&pageSize=50', admin)).data.items?.[0]?.id;
  const R = {};
  const seq = async (name, fn, n = 30) => { const s = []; for (let k = 0; k < n; k++) s.push(await fn(k)); R[name] = summary(name, s); };
  await seq('POST /auth/login (portal, bcrypt)', () => call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'SenhaForte!2026' }));
  await seq('POST /auth/app-login (motorista)', () => call('POST', '/auth/app-login', null, { companyCode: S.code, matricula: e.matricula }));
  await seq('GET /mobile/bootstrap (motorista)', () => call('GET', '/mobile/bootstrap', driver));
  await seq('POST /checklists/sync (1 inspeção, 40 itens)', (k) => call('POST', '/checklists/sync', driver, { checklists: [inspection(vehicleOf(e, k))] }));
  await seq('GET /dashboard/summary', () => call('GET', '/dashboard/summary', admin));
  await seq('GET /dashboard/report (30 dias, padrão)', () => call('GET', '/dashboard/report', admin));
  await seq('GET /dashboard/report?period=all', () => call('GET', '/dashboard/report?period=all', admin));
  await seq('GET /checklists (1ª página, 50)', () => call('GET', '/checklists?pageSize=50', admin));
  await seq('GET /checklists (página 400, 50)', () => call('GET', '/checklists?pageSize=50&page=400', admin));
  await seq('GET /checklists?search=BEN0123', () => call('GET', '/checklists?pageSize=50&search=BEN0123', admin));
  await seq('GET /checklists/:id (detalhe, 40 respostas)', () => call('GET', `/checklists/${someId}`, admin));
  await seq('GET /ncs (ativas)', () => call('GET', '/ncs?status=ACTIVE&pageSize=50', admin));
  if (nc) await seq('GET /ncs/:id', () => call('GET', `/ncs/${nc}`, admin));
  await seq('GET /vehicles (250)', () => call('GET', '/vehicles', admin));
  await seq('GET /employees (300)', () => call('GET', '/employees', admin));
  await seq('GET /templates', () => call('GET', '/templates', admin));
  results.latencia = R;
}

if (phases.includes('pico')) {
  for (const drivers of [50, 200]) {
    console.log(`\n== 2. Pico da manhã: ${drivers} motoristas ao mesmo tempo (entrar + baixar dados + enviar inspeção) ==`);
    const emps = S.employees.slice(0, drivers);
    const t0 = performance.now();
    const steps = await Promise.all(emps.map(async (e) => {
      const login = await call('POST', '/auth/app-login', null, { companyCode: S.code, matricula: e.matricula });
      const token = login.data?.access_token;
      const boot = await call('GET', '/mobile/bootstrap', token);
      const sync = await call('POST', '/checklists/sync', token, { checklists: [inspection(vehicleOf(e, 7))] });
      const ok = sync.data?.results?.[0]?.status;
      return { login, boot, sync: { ...sync, status: ok === 'CREATED' || ok === 'DUPLICATE' ? sync.status : 599, data: sync.data } };
    }));
    const total = (performance.now() - t0) / 1000;
    const R = {
      login: summary('entrar (app-login)', steps.map((s) => s.login)),
      bootstrap: summary('baixar dados (bootstrap)', steps.map((s) => s.boot)),
      sync: summary('enviar inspeção (sync)', steps.map((s) => s.sync)),
      totalSegundos: +total.toFixed(1),
    };
    console.log(`  tudo pronto em ${R.totalSegundos}s para ${drivers} motoristas`);
    results[`pico${drivers}`] = R;
  }
}

if (phases.includes('portal')) {
  console.log('\n== 3. 60s de uso contínuo: 20 gestores no portal + 50 motoristas enviando sem parar ==');
  const admin = await adminLogin();
  const tokens = await Promise.all(S.employees.slice(100, 150).map(driverLogin));
  const until = Date.now() + 60_000;
  const portal = { summary: [], report: [], list: [], detail: [], ncs: [] }, syncs = [];
  const ids = (await call('GET', '/checklists?pageSize=200', admin)).data.items.map((c) => c.id);
  const portalUser = async () => { while (Date.now() < until) {
    portal.summary.push(await call('GET', '/dashboard/summary', admin));
    portal.list.push(await call('GET', `/checklists?pageSize=50&page=${1 + Math.floor(Math.random() * 50)}`, admin));
    portal.detail.push(await call('GET', `/checklists/${ids[Math.floor(Math.random() * ids.length)]}`, admin));
    portal.ncs.push(await call('GET', '/ncs?status=ACTIVE&pageSize=50', admin));
    portal.report.push(await call('GET', '/dashboard/report', admin));
  } };
  const driver = async (k) => { const e = S.employees[100 + k]; let j = 0; while (Date.now() < until) {
    const r = await call('POST', '/checklists/sync', tokens[k], { checklists: [inspection(vehicleOf(e, j++))] });
    syncs.push({ ...r, status: r.data?.results?.[0]?.status === 'CREATED' ? r.status : 599 });
  } };
  await Promise.all([...Array.from({ length: 20 }, portalUser), ...tokens.map((_, k) => driver(k))]);
  results.portal = {
    painel: summary('painel (summary)', portal.summary), relatorio: summary('relatório (report)', portal.report),
    lista: summary('lista de inspeções', portal.list), detalhe: summary('detalhe da inspeção', portal.detail),
    ncs: summary('lista de NCs', portal.ncs), sync: summary('motoristas enviando', syncs),
    inspecoesPorMinuto: syncs.filter((s) => s.status < 300).length,
  };
  console.log(`  inspeções gravadas no minuto: ${results.portal.inspecoesPorMinuto}`);
}

if (phases.includes('duplicado')) {
  console.log('\n== 4. Confiabilidade do envio: a mesma inspeção reenviada 20x ao mesmo tempo (internet ruim) ==');
  const e = S.employees[250]; const token = await driverLogin(e); const insp = inspection(vehicleOf(e, 3));
  const rs = await Promise.all(Array.from({ length: 20 }, () => call('POST', '/checklists/sync', token, { checklists: [insp] })));
  const statuses = rs.map((r) => r.data?.results?.[0]?.status ?? r.status);
  const admin = await adminLogin();
  const found = (await call('GET', `/checklists?pageSize=200&search=${encodeURIComponent('BEN')}`, admin)).data;
  const counts = statuses.reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
  console.log('  respostas:', counts);
  results.duplicado = { respostas: counts };
}
mkdirSync('resultados', { recursive: true });
writeFileSync(`resultados/result-${Date.now()}.json`, JSON.stringify(results, null, 1));
