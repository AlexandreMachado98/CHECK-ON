import type { Request } from 'express';

/**
 * IP de quem fez a requisição. Na Vercel, a borda grava o IP real do cliente em
 * "x-vercel-forwarded-for"/"x-real-ip" (e sobrescreve o que o cliente mandar); fora dela,
 * vale o req.ip do Express (trust proxy). Usado nos limites de tentativas: sem isso, todos os
 * acessos poderiam aparecer com o IP do proxy e um bloqueio pegaria todo mundo.
 */
export function clientIp(req: Request): string | undefined {
  if (process.env.VERCEL === '1') {
    const forwarded = req.get('x-vercel-forwarded-for') || req.get('x-real-ip');
    const first = forwarded?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip;
}
