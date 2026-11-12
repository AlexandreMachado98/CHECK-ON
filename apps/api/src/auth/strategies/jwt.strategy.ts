import { jwtSecret } from '../../config/env';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(payload: any) {
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
