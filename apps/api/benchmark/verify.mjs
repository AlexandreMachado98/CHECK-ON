// Confere as contagens da API contra o banco (depois da troca do _count).
import { createRequire } from 'node:module';
const pg = createRequire(new URL('../package.json', import.meta.url))('@prisma/client');
const BASE = 'http://localhost:3499';
const login = await (await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@bench.test', password: 'SenhaForte!2026' }) })).json();
const get = async (p) => (await fetch(BASE + p, { headers: { authorization: `Bearer ${login.access_token}` } })).json();
const db = new pg.PrismaClient({ datasources: { db: { url: 'postgresql://bench:bench@localhost:5432/checkon_bench' } } });
let bad = 0;
const page = await get('/checklists?pageSize=200&page=3');
for (const c of page.items) {
  const n = await db.checklistAnswer.count({ where: { checklistId: c.id, isCompliant: false } });
  if (n !== c.ncCount) { bad++; console.log('inspeção', c.id, 'api', c.ncCount, 'banco', n); }
}
const vehicles = await get('/vehicles');
for (const v of vehicles) {
  const n = await db.nonConformity.count({ where: { vehicleId: v.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } });
  if (n !== v._count.ncs) { bad++; console.log('veículo', v.plate, 'api', v._count.ncs, 'banco', n); }
}
const ncs = await get('/ncs?status=ALL&pageSize=200');
for (const nc of ncs.items) {
  const n = await db.checklistAnswer.count({ where: { recurrentNcId: nc.id } });
  if (n !== nc._count.recurrences) { bad++; console.log('nc', nc.id, 'api', nc._count.recurrences, 'banco', n); }
}
const s1 = await get('/checklists?pageSize=200&search=BEN0123');
const exp = await db.checklist.count({ where: { vehicle: { plate: 'BEN0123' } } });
if (s1.total !== exp) { bad++; console.log('busca placa api', s1.total, 'banco', exp); }
const s2 = await get('/checklists?pageSize=10&search=motorista%2012');
const s3 = await get('/checklists?pageSize=10&search=di%C3%A1rio%20m%C3%A1quina');
console.log(`conferidos: ${page.items.length} inspeções, ${vehicles.length} veículos, ${ncs.items.length} NCs; busca placa=${s1.total}, motorista 12=${s2.total}, "diário máquina"=${s3.total} (1º ${s3.items[0]?.templateName}, mais recente ${s3.items[0]?.startedAt})`);
console.log(bad ? `DIFERENÇAS: ${bad}` : 'tudo igual ao banco');
await db.$disconnect();
