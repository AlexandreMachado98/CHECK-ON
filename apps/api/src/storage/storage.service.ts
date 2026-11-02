import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadRoot = resolve(process.env.UPLOADS_DIRECTORY || 'uploads');

  async uploadFile(fileBuffer: Buffer, _fileName: string, mimetype: string): Promise<string> {
    if (fileBuffer.length === 0 || fileBuffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('A foto precisa ter entre 1 byte e 5 MB.');
    }

    const imageType = this.detectImageType(fileBuffer);
    if (!imageType || imageType.mime !== mimetype) {
      throw new BadRequestException('Envie uma imagem JPEG, PNG ou WebP válida.');
    }

    const photoDirectory = resolve(this.uploadRoot, 'employee-photos');
    await mkdir(photoDirectory, { recursive: true });
    const fileName = `${randomUUID()}${imageType.extension}`;
    await writeFile(resolve(photoDirectory, fileName), fileBuffer, { flag: 'wx', mode: 0o640 });
    this.logger.log(`Stored employee photo ${fileName}`);
    const publicApiUrl = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || '3333'}`).replace(/\/$/, '');
    return `${publicApiUrl}/uploads/employee-photos/${fileName}`;
  }

  async deleteFile(publicPath: string): Promise<void> {
    let pathname: string;
    try {
      pathname = new URL(publicPath).pathname;
    } catch {
      return;
    }
    if (!pathname.startsWith('/uploads/employee-photos/')) return;
    const relativePath = pathname.replace(/^\/uploads\//, '');
    const uploadRootWithSeparator = `${this.uploadRoot}${sep}`;
    const resolvedPath = resolve(this.uploadRoot, relativePath);
    if (!resolvedPath.startsWith(uploadRootWithSeparator)) return;
    try {
      await unlink(resolvedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
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
