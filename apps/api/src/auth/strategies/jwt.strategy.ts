import { jwtSecret } from '../../config/env';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { SessionGuardCache } from '../session-guard.cache';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly sessionGuard: SessionGuardCache) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    // Bloqueio de usuário, empresa desativada, sessões revogadas ou senha trocada valem antes de o token expirar.
    await this.sessionGuard.assertValid(payload, req.originalUrl ?? req.url);
    // Retorna o contexto seguro validado para o req.user
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
      permissions: payload.permissions,
      // Presente quando um super admin está dentro do painel de uma empresa ("Acessar empresa").
      impersonatedBy: payload.impersonatedBy ?? null,
    };
  }
}
