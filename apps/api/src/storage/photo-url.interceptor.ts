import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import { StorageService } from './storage.service';

/** Endereço público da API nesta requisição (atrás do proxy HTTPS; na Vercel a API fica em /api). */
export function apiBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}${process.env.VERCEL === '1' ? '/api' : ''}`;
}

/** Campos com imagem do armazenamento: fotos dos itens e assinatura do colaborador. */
const PHOTO_KEYS = new Set(['photoUrl', 'signatureUrl']);

/**
 * Nas respostas, todo campo "photoUrl" (e "signatureUrl") passa a apontar para a rota /fotos da API.
 * O banco continua guardando o endereço do armazenamento: fotos antigas voltam a aparecer sem migração.
 */
@Injectable()
export class PhotoUrlInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const base = apiBaseUrl(context.switchToHttp().getRequest<Request>());
    return next.handle().pipe(map((data) => this.rewrite(data, base, 0)));
  }

  private rewrite(value: unknown, base: string, depth: number): unknown {
    if (depth > 12 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = this.rewrite(value[i], base, depth + 1);
      return value;
    }
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const item = record[key];
      if (PHOTO_KEYS.has(key) && typeof item === 'string' && item) record[key] = this.storage.displayUrl(item, base);
      else if (item && typeof item === 'object') record[key] = this.rewrite(item, base, depth + 1);
    }
    return record;
  }
}
