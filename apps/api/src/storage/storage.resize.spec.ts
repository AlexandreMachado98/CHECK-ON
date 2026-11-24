import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { StorageService, resizedKey } from './storage.service';

const TENANT = '11111111-2222-3333-4444-555555555555';

async function read(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Foto como a do app: 1280x960, JPEG, com textura (para o tamanho ser realista). */
async function appPhoto(): Promise<Buffer> {
  const noise = Buffer.alloc(1280 * 960 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919 + (i >> 9) * 31) % 255;
  return sharp(noise, { raw: { width: 1280, height: 960, channels: 3 } }).jpeg({ quality: 60 }).toBuffer();
}

describe('versões reduzidas das fotos (miniatura do portal e PDF)', () => {
  let storage: StorageService;
  let dir: string;
  let key: string;
  let original: Buffer;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'checkon-fotos-'));
    process.env.STORAGE_DRIVER = 'local';
    process.env.UPLOADS_DIRECTORY = dir;
    process.env.PUBLIC_API_URL = 'https://api.exemplo.test';
    storage = new StorageService();
    original = await appPhoto();
    const url = await storage.uploadChecklistPhoto(original, 'image/jpeg', TENANT);
    key = url.slice(url.indexOf('checklist-photos/'));
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  it('chave da versão reduzida fica ao lado da original', () => {
    expect(resizedKey(`checklist-photos/${TENANT}/abc.jpg`, 320)).toBe(`checklist-photos/${TENANT}/abc.w320.jpg`);
    expect(resizedKey(`checklist-photos/${TENANT}/abc.png`, 900)).toBe(`checklist-photos/${TENANT}/abc.w900.jpg`);
  });

  it('miniatura de 320 px, bem menor que a original, e guardada para as próximas vezes', async () => {
    const first = await storage.getResizedPhoto(key, 320);
    const body = await read(first!.body);
    const meta = await sharp(body).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
    expect(meta.format).toBe('jpeg');
    expect(body.length).toBeLessThan(original.length / 4);
    // Guardada: a segunda vez só lê o arquivo.
    await expect(stat(join(dir, resizedKey(key, 320)))).resolves.toBeTruthy();
    const second = await read((await storage.getResizedPhoto(key, 320))!.body);
    expect(second.equals(body)).toBe(true);
  });

  it('900 px para o PDF; foto menor que o pedido não é ampliada', async () => {
    const pdf = await sharp(await read((await storage.getResizedPhoto(key, 900))!.body)).metadata();
    expect(pdf.width).toBe(900);
    const smallUrl = await storage.uploadChecklistPhoto(await sharp({ create: { width: 200, height: 150, channels: 3, background: '#888' } }).jpeg().toBuffer(), 'image/jpeg', TENANT);
    const small = await sharp(await read((await storage.getResizedPhoto(smallUrl.slice(smallUrl.indexOf('checklist-photos/')), 320))!.body)).metadata();
    expect(small.width).toBe(200);
  });

  it('só os tamanhos combinados e só chaves de foto válidas', async () => {
    await expect(storage.getResizedPhoto(key, 640 as never)).resolves.toBeNull();
    await expect(storage.getResizedPhoto('../.env', 320)).resolves.toBeNull();
    await expect(storage.getResizedPhoto(`checklist-photos/${TENANT}/00000000-0000-0000-0000-000000000000.jpg`, 320)).resolves.toBeNull();
  });

  it('apagar a foto apaga também as versões reduzidas', async () => {
    await storage.deleteFile(`https://api.exemplo.test/uploads/${key}`);
    await expect(stat(join(dir, key))).rejects.toThrow();
    await expect(stat(join(dir, resizedKey(key, 320)))).rejects.toThrow();
    await expect(stat(join(dir, resizedKey(key, 900)))).rejects.toThrow();
  });
});
