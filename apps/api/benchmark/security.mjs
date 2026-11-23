// Verificações de segurança contra a API do benchmark: isolamento entre empresas, login, token, envio.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const BASE = 'http://localhost:3499';
const S = JSON.parse(readFileSync('setup.json', 'utf8'));
let checks = 0, fails = 0;
const check = (label, ok, detail) => { checks++; if (ok) console.log(`  ok   ${label}`); else { fails++; console.log(`  FAIL ${label}`, detail ?? ''); } };
async function call(method, path, token, body, headers = {}) {
  const res = await fetch(BASE + path, { method, headers: { ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const login = async (email, password) => (await call('POST', '/auth/login', null, { email, password })).data;

console.log('== Empresa vizinha (outro cliente) tentando ver dados da frota de 250 ==');
const sup = (await login('admin@checkon.com', 'admin123')).access_token;
const code2 = `VIZ${Date.now().toString(36).slice(-4).toUpperCase()}`;
await call('POST', '/admin/tenants', sup, { name: 'Empresa Vizinha', code: code2, adminName: 'Viz', adminEmail: `viz${code2.toLowerCase()}@viz.test`, adminPassword: 'Provisoria123' });
let r = await login(`viz${code2.toLowerCase()}@viz.test`, 'Provisoria123');
await call('POST', '/auth/change-password', r.access_token, { currentPassword: 'Provisoria123', newPassword: 'SenhaForte!2026' });
const viz = (await login(`viz${code2.toLowerCase()}@viz.test`, 'SenhaForte!2026')).access_token;
const admin = (await login('admin@bench.test', 'SenhaForte!2026')).access_token;
const someChecklist = (await call('GET', '/checklists?pageSize=1', admin)).data.items[0].id;
const someNc = (await call('GET', '/ncs?pageSize=1&status=ALL', admin)).data.items[0].id;
const someVehicle = S.vehicles[0].id, someEmployee = S.employees[0].id;
check('lista de inspeções da vizinha vem vazia', (await call('GET', '/checklists', viz)).data.total === 0);
check('lista de veículos da vizinha vem vazia', (await call('GET', '/vehicles', viz)).data.length === 0);
check('lista de NCs da vizinha vem vazia', (await call('GET', '/ncs?status=ALL', viz)).data.total === 0);
check('painel da vizinha não conta a frota de 250', (await call('GET', '/dashboard/report', viz)).data.inspections.total === 0);
for (const [label, path] of [['inspeção', `/checklists/${someChecklist}`], ['NC', `/ncs/${someNc}`], ['veículo', `/vehicles/${someVehicle}`], ['colaborador', `/employees/${someEmployee}`]]) {
  check(`abrir ${label} da outra empresa pelo id: 404`, (await call('GET', path, viz)).status === 404);
}
check('alterar veículo da outra empresa: 404', (await call('PATCH', `/vehicles/${someVehicle}`, viz, { model: 'invadido' })).status === 404);
check('excluir inspeção da outra empresa: 404', (await call('DELETE', `/checklists/${someChecklist}`, viz)).status === 404);
check('registrar ação em NC da outra empresa: 404', [403, 404].includes((await call('POST', `/ncs/${someNc}/actions`, viz, { text: 'x' })).status));
const vizRoles = (await call('GET', '/roles', viz)).data; const vMot = (Array.isArray(vizRoles) ? vizRoles : vizRoles.items).find((x) => x.name === 'MOTORISTA');
const vizEmp = (await call('POST', '/employees', viz, { name: 'Motorista vizinho', matricula: 'V1' })).data;
await call('POST', '/users/access', viz, { employeeId: vizEmp.id, roleId: vMot.id });
const vizDriver = (await call('POST', '/auth/app-login', null, { companyCode: code2, matricula: 'V1' })).data.access_token;
const boot = (await call('GET', '/mobile/bootstrap', vizDriver)).data;
check('app do motorista vizinho não recebe veículos nem checklists da frota de 250', boot.vehicles.length === 0 && boot.templates.length === 0);
const cross = await call('POST', '/checklists/sync', vizDriver, { checklists: [{ clientId: randomUUID(), templateId: S.tplTruck.id, vehicleId: someVehicle, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), answers: [{ itemId: S.tplTruck.items[0].id, isCompliant: true }] }] });
check('motorista vizinho enviando inspeção para veículo da outra empresa: recusada', cross.data?.results?.[0]?.status === 'REJECTED', cross.data);
check('id inventado/malicioso na URL: 400/404 sem erro interno', [400, 404].includes((await call('GET', `/checklists/' OR 1=1 --`, admin)).status));
const inj = await call('GET', `/checklists?search=${encodeURIComponent("' OR '1'='1")}`, admin);
check('busca com SQL malicioso não vaza nada', inj.status === 200 && inj.data.total === 0, inj.data?.total);

console.log('\n== Login e sessão ==');
check('sem token: 401', (await call('GET', '/checklists')).status === 401);
const [h, p, s] = admin.split('.');
const forged = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), role: 'SUPER_ADMIN' })).toString('base64url')}.${s}`;
check('token adulterado (virar SUPER_ADMIN): 401', (await call('GET', '/checklists', forged)).status === 401);
check('motorista não acessa o portal (lista de inspeções): 403', (await call('GET', '/checklists', vizDriver)).status === 403);
check('motorista não acessa rotas do super admin: 403', [401, 403].includes((await call('GET', '/admin/tenants', vizDriver)).status));
let blocked = 0, codes = [];
const vizEmail = `viz${code2.toLowerCase()}@viz.test`;
for (let k = 0; k < 35; k++) { const x = await call('POST', '/auth/login', null, { email: k < 6 ? vizEmail : `naoexiste${k}@x.test`, password: `errada${k}` }, { 'x-forwarded-for': '203.0.113.9' }); codes.push(x.status); if (x.status === 429) blocked++; }
check('senha errada repetida: bloqueia a conta (429) após 5 erros e a rede após ~30', codes[5] === 429 && codes.slice(32).every((c) => c === 429), codes.join(','));
const afterBlock = await call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'SenhaForte!2026' }, { 'x-forwarded-for': '203.0.113.9' });
check('mesmo com a senha certa, a rede bloqueada espera', afterBlock.status === 429, afterBlock.status);
const otherIp = await call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'SenhaForte!2026' }, { 'x-forwarded-for': '198.51.100.7' });
check('outra rede continua entrando normalmente', otherIp.status === 200, otherIp.status);

console.log('\n== Envio de dados e arquivos ==');
const driver = (await call('POST', '/auth/app-login', null, { companyCode: S.code, matricula: S.employees[5].matricula })).data.access_token;
const big = new FormData(); big.append('file', new Blob([Buffer.alloc(12 * 1024 * 1024, 1)], { type: 'image/jpeg' }), 'grande.jpg');
check('foto de 12 MB: recusada (413/400)', [400, 413].includes((await call('POST', '/checklists/photos', driver, big)).status));
const fake = new FormData(); fake.append('file', new Blob([Buffer.from('<script>alert(1)</script>')], { type: 'image/jpeg' }), 'x.jpg');
const fakeR = await call('POST', '/checklists/photos', driver, fake);
check('arquivo que não é imagem disfarçado de .jpg: recusado', fakeR.status === 400, `${fakeR.status} ${JSON.stringify(fakeR.data).slice(0, 120)}`);
const html = new FormData(); html.append('file', new Blob(['<html></html>'], { type: 'text/html' }), 'x.html');
check('arquivo HTML: recusado', (await call('POST', '/checklists/photos', driver, html)).status === 400);
const extra = await call('POST', '/checklists/sync', driver, { checklists: [], admin: true });
check('campo não previsto no envio: recusado (400)', extra.status === 400);
const many = await call('POST', '/checklists/sync', driver, { checklists: Array.from({ length: 500 }, () => ({ clientId: randomUUID(), templateId: S.tplTruck.id, vehicleId: S.vehicles[0].id, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), answers: [] })) });
check('lote gigante de 500 inspeções: limitado (400)', many.status === 400 || many.status === 413, many.status);
const future = await call('POST', '/checklists/sync', driver, { checklists: [{ clientId: randomUUID(), templateId: S.tplTruck.id, vehicleId: S.vehicles.find((v) => v.unit === S.employees[5].unit).id, startedAt: '2030-01-01T00:00:00Z', completedAt: '2030-01-01T00:10:00Z', answers: [{ itemId: S.tplTruck.items[0].id, isCompliant: true }] }] });
check('inspeção com data no futuro: recusada', future.data?.results?.[0]?.status === 'REJECTED', JSON.stringify(future.data).slice(0, 160));
console.log(`\n${checks - fails}/${checks} verificações passaram.`);
