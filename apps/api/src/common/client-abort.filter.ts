import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';

/**
 * O celular perdeu o sinal no meio do envio (comum no pátio): o upload da foto é interrompido.
 * Não é erro do servidor: o app guarda a foto e tenta de novo. Registrar como ERROR, com o rastro
 * inteiro, enchia o log de falsos alarmes; fica como aviso de uma linha.
 */
export function isClientAbort(error: unknown): boolean {
  return error instanceof Error && (error.message === 'Request aborted' || error.message === 'Request closed');
}

@Catch()
export class ClientAbortFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Envio');

  catch(exception: unknown, host: ArgumentsHost) {
    if (isClientAbort(exception)) {
      const request = host.switchToHttp().getRequest<Request>();
      this.logger.warn(`Envio interrompido pelo aparelho (conexão caiu): ${request.method} ${request.path}`);
      return; // ninguém do outro lado para receber resposta
    }
    super.catch(exception, host);
  }
}
