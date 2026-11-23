// Cria o acesso ao aplicativo (perfil MOTORISTA) para os 300 colaboradores do benchmark.
import { readFileSync } from 'node:fs';
const BASE = 'http://localhost:3499';
const S = JSON.parse(readFileSync('setup.json', 'utf8'));
async function call(method, path, token, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (res.status >= 400) { console.log('ERRO', path, res.status, JSON.stringify(data).slice(0, 200)); process.exit(1); }
  return data;
}
const admin = (await call('POST', '/auth/login', null, { email: 'admin@bench.test', password: 'SenhaForte!2026' })).access_token;
const roles = await call('GET', '/roles', admin);
const motorista = (Array.isArray(roles) ? roles : roles.items).find((r) => r.name === 'MOTORISTA');
for (const e of S.employees) await call('POST', '/users/access', admin, { employeeId: e.id, roleId: motorista.id });
console.log('acessos criados:', S.employees.length);
