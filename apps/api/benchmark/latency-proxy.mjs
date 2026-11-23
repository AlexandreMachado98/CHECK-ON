// Intermediário TCP que atrasa o tráfego até o PostgreSQL, para simular o banco longe da API
// (ex.: Vercel em São Paulo e Neon em outra região). Uso: node latency-proxy.mjs <porta> <ms por sentido>
import net from 'node:net';
const [port = 6432, delay = 25] = process.argv.slice(2).map(Number);
net.createServer((client) => {
  const db = net.connect(5432, '127.0.0.1');
  const pipe = (from, to) => from.on('data', (chunk) => setTimeout(() => to.write(chunk), delay));
  pipe(client, db); pipe(db, client);
  const close = () => { client.destroy(); db.destroy(); };
  client.on('error', close); db.on('error', close); client.on('close', close); db.on('close', close);
}).listen(port, () => console.log(`proxy ${port} -> 5432 com +${delay} ms em cada sentido`));
