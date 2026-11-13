import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Nome amigável dos campos únicos, para a mensagem de duplicidade. */
const FIELD_LABELS: Record<string, string> = {
  plate: 'placa',
  email: 'e-mail',
  cnpj: 'CNPJ',
  matricula: 'matrícula',
  qrCode: 'QR Code',
  name: 'nome',
  clientId: 'identificador do checklist',
  employeeId: 'colaborador',
};

/**
 * Erros conhecidos do Prisma viram respostas claras, em vez de "Internal server error" (500).
 * P2002: valor duplicado em campo único -> 409; P2025: registro não encontrado -> 404;
 * P2003: registro ainda usado por outro -> 409.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const send = (status: number, message: string) =>
      response.status(status).json({ statusCode: status, message, error: HttpStatus[status] });

    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[] | string | undefined) ?? [];
        const fields = (Array.isArray(target) ? target : [target]).filter((f) => f !== 'tenantId');
        const label = fields.map((f) => FIELD_LABELS[f] ?? f).join(', ');
        return send(HttpStatus.CONFLICT, label ? `Já existe um cadastro com esta ${label}.` : 'Este registro já existe.');
      }
      case 'P2025':
        return send(HttpStatus.NOT_FOUND, 'Registro não encontrado.');
      case 'P2003':
        return send(HttpStatus.CONFLICT, 'Este registro está vinculado a outros dados e não pode ser alterado assim.');
      default:
        this.logger.error(`Erro do Prisma ${error.code}`, error.stack);
        return send(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro interno ao acessar os dados. Tente novamente.');
    }
  }
}
