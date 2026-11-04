import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { publicApiUrl, s3Config, storageDriver } from '../config/env';

/** Pastas (prefixos) que a API pode gravar e apagar. */
const ALLOWED_PREFIXES = ['employee-photos/', 'checklist-photos/'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface StorageDriver {
  readonly publicBaseUrl: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Desenvolvimento: grava em disco e a API serve os arquivos em /uploads. */
class LocalDriver implements StorageDriver {
  private readonly root = resolve(process.env.UPLOADS_DIRECTORY || 'uploads');
  readonly publicBaseUrl = `${publicApiUrl()}/uploads`;

  private pathFor(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new BadRequestException('Destino inválido.');
    return path;
  }

  async put(key: string, body: Buffer) {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx', mode: 0o640 });
  }

  async remove(key: string) {
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** Produção: qualquer armazenamento compatível com S3 (Cloudflare R2, AWS S3, Backblaze B2, MinIO). */
class S3Driver implements StorageDriver {
  private readonly config = s3Config();
  private readonly client = new S3Client({
    region: this.config.region,
    endpoint: this.config.endpoint,
    forcePathStyle: this.config.forcePathStyle,
    credentials: { accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey },
  });
  readonly publicBaseUrl = this.config.publicUrl;

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Nomes são UUIDs e nunca mudam: o arquivo pode ficar em cache por muito tempo.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver = storageDriver() === 's3' ? new S3Driver() : new LocalDriver();

  /** Foto de funcionário (crachá). */
  async uploadFile(fileBuffer: Buffer, _fileName: string, mimetype: string): Promise<string> {
    return this.storeImage(fileBuffer, mimetype, 'employee-photos');
  }

  /** Evidência fotográfica de checklist, separada por empresa. */
  async uploadChecklistPhoto(fileBuffer: Buffer, mimetype: string, tenantId: string): Promise<string> {
    if (!/^[A-Za-z0-9-]+$/.test(tenantId)) throw new BadRequestException('Empresa inválida.');
    return this.storeImage(fileBuffer, mimetype, `checklist-photos/${tenantId}`);
  }

  /** Só aceita fotos enviadas por esta API para a mesma empresa. */
  isChecklistPhotoUrl(url: string, tenantId: string): boolean {
    const key = this.keyFromUrl(url);
    if (!key) return false;
    const prefix = `checklist-photos/${tenantId}/`;
    return key.startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key.slice(prefix.length));
  }

  async deleteFile(publicUrl: string): Promise<void> {
    const key = this.keyFromUrl(publicUrl);
    if (!key || !ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) return;
    await this.driver.remove(key);
  }

  /** Converte uma URL pública na chave do arquivo, ou null se não for deste armazenamento. */
  private keyFromUrl(url: string): string | null {
    let target: URL;
    let base: URL;
    try {
      target = new URL(url);
      base = new URL(`${this.driver.publicBaseUrl}/`);
    } catch {
      return null;
    }
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return null;
    const key = decodeURIComponent(target.pathname.slice(base.pathname.length));
    if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) return null;
    return key;
  }

  private async storeImage(fileBuffer: Buffer, mimetype: string, folder: string): Promise<string> {
    if (fileBuffer.length === 0 || fileBuffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('A foto precisa ter entre 1 byte e 5 MB.');
    }
    const imageType = this.detectImageType(fileBuffer);
    if (!imageType || imageType.mime !== mimetype) {
      throw new BadRequestException('Envie uma imagem JPEG, PNG ou WebP válida.');
    }
    const key = `${folder}/${randomUUID()}${imageType.extension}`;
    await this.driver.put(key, fileBuffer, imageType.mime);
    this.logger.log(`Stored ${key}`);
    return `${this.driver.publicBaseUrl}/${key}`;
  }

  private detectImageType(buffer: Buffer): { mime: string; extension: string } | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', extension: '.jpg' };
    }
    if (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return { mime: 'image/png', extension: '.png' };
    }
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { mime: 'image/webp', extension: '.webp' };
    }
    return null;
  }
}
