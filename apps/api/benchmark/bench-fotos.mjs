// Benchmark com fotos: motoristas enviando inspeções com 1, 4 ou 40 fotos ao mesmo tempo,
// como o app faz (entra, baixa os dados, envia as fotos uma a uma e depois a inspeção).
// Uso: node bench-fotos.mjs [cenários...] [--motoristas=50,200]   cenários: 1 4 40 queda   (padrão: todos)
// Requer: setup.json (setup.mjs + access.mjs) e as fotos (python3 make-photos.py fotos).
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

const BASE = process.env.API ?? 'http://localhost:3499';
const UPLOADS = process.env.UPLOADS_DIRECTORY ?? '/tmp/checkon-bench-uploads';
const S = JSON.parse(readFileSync('setup.json', 'utf8'));
const args = process.argv.slice(2);
const driversArg = args.find((a) => a.startsWith('--motoristas='));
const DRIVERS = driversArg ? driversArg.split('=')[1].split(',').map(Number) : [50, 200];
const scenarios = args.filter((a) => !a.startsWith('--'));
const run = scenarios.length ? scenarios : ['1', '4', '40', 'queda'];
const PHOTOS = readdirSync('fotos').filter((f) => f.endsWith('.jpg')).map((f) => readFileSync(`fotos/${f}`));
const avgPhoto = PHOTOS.reduce((a, b) => a + b.length, 0) / PHOTOS.length;
const results = { fotoMediaKB: Math.round(avgPhoto / 1024) };

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0; };
const fmt = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`);
async function json(method, path, token, body) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    return { ms: performance.now() - t0, status: res.status, data };
  } catch (e) { return { ms: performance.now() - t0, status: 0, data: String(e) }; }
}
async function upload(token, buffer) {
  const t0 = performance.now();
  const fd = new FormData(); fd.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'foto.jpg');
  try {
    const res = await fetch(BASE + '/checklists/photos', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
    const data = await res.json().catch(() => null);
    return { ms: performance.now() - t0, status: res.status, url: data?.photoUrl, data };
  } catch (e) { return { ms: performance.now() - t0, status: 0, data: String(e) }; }
}
const apiPid = () => execSync('pgrep -f "node dist/main" | head -1').toString().trim();
const rssMB = (pid) => { try { return +(readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1] / 1024).toFixed(0); } catch { return 0; } };
function dirStats(dir) { let n = 0, bytes = 0; const walk = (d) => { if (!existsSync(d)) return; for (const f of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else { n++; bytes += statSync(p).size; } } }; walk(dir); return { n, bytes }; }

/** Respostas de uma inspeção com `photos` fotos: 1 = só no item com problema; 4 = problema + 3; 40 = todos. */
function answersWithPhotos(tpl, urls) {
  return tpl.items.map((it, k) => {
    const base = it.type === 'NUMBER' ? { itemId: it.id, numberValue: 123456 } : { itemId: it.id, isCompliant: k !== 3, ...(k === 3 ? { observations: 'Pneu com desgaste' } : {}) };
    const order = k === 3 ? 0 : k < 3 ? k + 1 : k; // o item com problema recebe a 1ª foto
    return urls[order] ? { ...base, photoUrl: urls[order] } : base;
  });
}
const vehicleFor = (e, j) => { const vs = S.vehicles.filter((v) => v.unit === e.unit && v.template === 'truck'); return vs[(S.employees.indexOf(e) + j) % vs.length]; };

for (const scen of run.filter((s) => s !== 'queda').map(Number)) {
  for (const drivers of DRIVERS) {
    console.log(`\n== ${scen} foto(s) por inspeção · ${drivers} motoristas ao mesmo tempo ==`);
    const emps = S.employees.slice(0, drivers);
    const pid = apiPid(); let peak = rssMB(pid); const rss0 = peak;
    const sampler = setInterval(() => { peak = Math.max(peak, rssMB(pid)); }, 200);
    const disk0 = dirStats(UPLOADS);
    const t0 = performance.now();
    const all = await Promise.all(emps.map(async (e, i) => {
      const start = performance.now();
      const login = await json('POST', '/auth/app-login', null, { companyCode: S.code, matricula: e.matricula });
      const token = login.data?.access_token;
      const boot = await json('GET', '/mobile/bootstrap', token);
      const ups = [];
      for (let k = 0; k < scen; k++) ups.push(await upload(token, PHOTOS[(i + k) % PHOTOS.length])); // uma a uma, como o app
      const urls = ups.map((u) => u.url);
      const now = new Date();
      const sync = await json('POST', '/checklists/sync', token, { checklists: [{
        clientId: randomUUID(), templateId: S.tplTruck.id, templateVersion: S.tplTruck.version, vehicleId: vehicleFor(e, scen).id,
        startedAt: new Date(now - 900_000).toISOString(), completedAt: now.toISOString(), signedName: 'Motorista',
        answers: answersWithPhotos(S.tplTruck, urls),
      }] });
      const okSync = sync.data?.results?.[0]?.status === 'CREATED';
      return { login, boot, ups, sync, okSync, total: performance.now() - start, syncMsg: okSync ? '' : JSON.stringify(sync.data).slice(0, 200) };
    }));
    const wall = (performance.now() - t0) / 1000;
    clearInterval(sampler);
    const disk1 = dirStats(UPLOADS);
    const ups = all.flatMap((a) => a.ups);
    const upErr = ups.filter((u) => u.status !== 201);
    const failed = all.filter((a) => !a.okSync);
    const totals = all.map((a) => a.total);
    const r = {
      fotosEnviadas: ups.length - upErr.length, errosFoto: upErr.length, inspecoesGravadas: all.length - failed.length, errosInspecao: failed.length,
      fotoP50: Math.round(pct(ups.map((u) => u.ms), 50)), fotoP95: Math.round(pct(ups.map((u) => u.ms), 95)), fotoMax: Math.round(Math.max(...ups.map((u) => u.ms))),
      syncP95: Math.round(pct(all.map((a) => a.sync.ms), 95)),
      porMotoristaP50: Math.round(pct(totals, 50)), porMotoristaP95: Math.round(pct(totals, 95)), porMotoristaMax: Math.round(Math.max(...totals)),
      totalSegundos: +wall.toFixed(1), mbEnviados: +(ups.reduce((a, u, k) => a + (u.status === 201 ? avgPhoto : 0), 0) / 1048576).toFixed(0),
      mbPorSegundo: +((disk1.bytes - disk0.bytes) / 1048576 / wall).toFixed(1), discoMB: +((disk1.bytes - disk0.bytes) / 1048576).toFixed(0),
      memoriaApiMB: { antes: rss0, pico: peak },
    };
    console.log(`  fotos: ${r.fotosEnviadas} ok, ${r.errosFoto} erros · cada foto p50 ${fmt(r.fotoP50)}, p95 ${fmt(r.fotoP95)}, máx ${fmt(r.fotoMax)}`);
    console.log(`  inspeções: ${r.inspecoesGravadas} gravadas, ${r.errosInspecao} erros · envio da inspeção p95 ${fmt(r.syncP95)}`);
    console.log(`  por motorista (entrar → última foto → inspeção gravada): p50 ${fmt(r.porMotoristaP50)}, p95 ${fmt(r.porMotoristaP95)}, máx ${fmt(r.porMotoristaMax)}`);
    console.log(`  tudo em ${r.totalSegundos}s · ${r.discoMB} MB gravados (${r.mbPorSegundo} MB/s) · memória da API ${rss0} → pico ${peak} MB`);
    if (upErr.length) console.log('  exemplo erro foto:', upErr[0].status, JSON.stringify(upErr[0].data).slice(0, 200));
    if (failed.length) console.log('  exemplo erro inspeção:', failed[0].syncMsg);
    results[`${scen}foto_${drivers}`] = r;
  }
}

if (run.includes('queda')) {
  console.log('\n== Internet caindo no meio do envio da foto ==');
  const e = S.employees[260];
  const token = (await json('POST', '/auth/app-login', null, { companyCode: S.code, matricula: e.matricula })).data.access_token;
  const before = dirStats(UPLOADS).n;
  // Envia metade do arquivo e derruba a conexão (como o sinal sumindo no pátio).
  const photo = PHOTOS[0]; const boundary = '----checkon' + randomUUID();
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="foto.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const url = new URL(BASE + '/checklists/photos');
  const outcomes = [];
  for (let i = 0; i < 20; i++) {
    outcomes.push(await new Promise((resolve) => {
      const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': head.length + photo.length + tail.length } });
      req.on('error', () => resolve('conexão derrubada')); req.on('response', (res) => resolve(`resposta ${res.statusCode}`));
      req.write(head); req.write(photo.subarray(0, Math.floor(photo.length / 2)));
      setTimeout(() => { req.destroy(); }, 150);
    }));
  }
  await new Promise((r) => setTimeout(r, 1000));
  const orphan = dirStats(UPLOADS).n - before;
  const health = await json('GET', '/health');
  // O app tenta de novo: a foto inteira sobe e a inspeção é gravada uma vez só, mesmo reenviada.
  const retry = await upload(token, photo);
  const insp = { clientId: randomUUID(), templateId: S.tplTruck.id, templateVersion: S.tplTruck.version, vehicleId: vehicleFor(e, 1).id,
    startedAt: new Date(Date.now() - 600_000).toISOString(), completedAt: new Date().toISOString(), signedName: 'Motorista', answers: answersWithPhotos(S.tplTruck, [retry.url]) };
  const sends = await Promise.all([1, 2, 3].map(() => json('POST', '/checklists/sync', token, { checklists: [insp] })));
  const statuses = sends.map((s) => s.data?.results?.[0]?.status);
  console.log(`  20 envios cortados ao meio: ${[...new Set(outcomes)].join(', ')} · arquivos pela metade gravados: ${orphan} · API depois: ${health.status}`);
  console.log(`  nova tentativa da foto: ${retry.status} · inspeção reenviada 3x: ${statuses.join(', ')}`);
  results.queda = { cortes: outcomes.length, arquivosOrfaos: orphan, apiDepois: health.status, novaTentativa: retry.status, reenvios: statuses };
}
mkdirSync('resultados', { recursive: true });
writeFileSync(`resultados/fotos-${Date.now()}.json`, JSON.stringify(results, null, 1));
