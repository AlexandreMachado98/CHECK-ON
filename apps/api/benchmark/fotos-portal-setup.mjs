// Cria 3 inspeções no veículo BEN0249 com 1, 4 e 40 fotos (a de 40 é a mais recente), para medir
// o detalhe da inspeção e o PDF no portal. Grava fotos-portal.json com placa e ids.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const BASE = 'http://localhost:3499';
const S = JSON.parse(readFileSync('setup.json', 'utf8'));
const PHOTOS = readdirSync('fotos').filter((f) => f.endsWith('.jpg')).map((f) => readFileSync(`fotos/${f}`));
const vehicle = S.vehicles.filter((v) => v.template === 'truck').at(-1);
const plate = 'BEN' + String(S.vehicles.indexOf(vehicle)).padStart(4, '0');
const driver = S.employees.find((e) => e.unit === vehicle.unit);
const token = (await (await fetch(BASE + '/auth/app-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ companyCode: S.code, matricula: driver.matricula }) })).json()).access_token;
const out = { plate, inspecoes: {} };
for (const [n, hoursAgo] of [[1, 3], [4, 2], [40, 1]]) {
  const urls = [];
  for (let k = 0; k < n; k++) {
    const fd = new FormData(); fd.append('file', new Blob([PHOTOS[k % PHOTOS.length]], { type: 'image/jpeg' }), 'f.jpg');
    urls.push((await (await fetch(BASE + '/checklists/photos', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd })).json()).photoUrl);
  }
  const completedAt = new Date(Date.now() - hoursAgo * 3600_000);
  const answers = S.tplTruck.items.map((it, k) => {
    const base = it.type === 'NUMBER' ? { itemId: it.id, numberValue: 123456 } : { itemId: it.id, isCompliant: k !== 3, ...(k === 3 ? { observations: 'Pneu com desgaste' } : {}) };
    const order = k === 3 ? 0 : k < 3 ? k + 1 : k;
    return urls[order] ? { ...base, photoUrl: urls[order] } : base;
  });
  const r = await (await fetch(BASE + '/checklists/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ checklists: [{ clientId: randomUUID(), templateId: S.tplTruck.id, templateVersion: S.tplTruck.version, vehicleId: vehicle.id, startedAt: new Date(completedAt - 900_000).toISOString(), completedAt: completedAt.toISOString(), signedName: driver.matricula, answers }] }) })).json();
  out.inspecoes[n] = r.results[0].checklistId;
  console.log(`${n} foto(s): ${r.results[0].status} ${r.results[0].checklistId}`);
}
writeFileSync('fotos-portal.json', JSON.stringify(out, null, 1));
console.log('placa', plate);
