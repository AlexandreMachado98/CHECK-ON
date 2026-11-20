import { Controller, Get, Logger, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PHOTO_ROUTE, StorageService } from './storage.service';

/**
 * Entrega as fotos (inspeções e crachás) lendo do armazenamento: o bucket pode ser privado.
 * Sem login, como antes: o endereço tem um UUID impossível de adivinhar, e a <img> do navegador
 * não envia o token. Os arquivos nunca mudam (nome novo a cada foto), então podem ficar em cache.
 */
@Controller(PHOTO_ROUTE)
export class PhotosController {
  private readonly logger = new Logger('Fotos');

  constructor(private readonly storage: StorageService) {}

  // Express 5: curinga com nome ("*key"); chega como lista de partes do caminho.
  @Get('*key')
  async get(@Req() req: Request, @Res() res: Response) {
    const raw = (req.params as Record<string, string | string[]>).key ?? '';
    const key = Array.isArray(raw) ? raw.join('/') : decodeURIComponent(raw);
    let file;
    try {
      file = await this.storage.getPhoto(key);
    } catch (error) {
      this.logger.error(`Falha ao ler a foto ${key}: ${(error as Error).message}`);
      res.status(502).json({ statusCode: 502, message: 'Não foi possível ler a foto no armazenamento.' });
      return;
    }
    if (!file) throw new NotFoundException('Foto não encontrada.');
    res.setHeader('Content-Type', file.contentType);
    if (file.length) res.setHeader('Content-Length', String(file.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    file.body.on('error', () => res.destroy());
    file.body.pipe(res);
  }
}
