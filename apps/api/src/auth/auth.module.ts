import { jwtSecret, jwtExpiresIn } from '../config/env';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionGuardCache } from './session-guard.cache';
import { NeonAuthClient } from './neon-auth.client';
import { PasswordRecoveryService } from './password-recovery.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      global: true,
      secret: jwtSecret(),
      signOptions: { expiresIn: jwtExpiresIn() as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SessionGuardCache, NeonAuthClient, PasswordRecoveryService],
  exports: [AuthService, SessionGuardCache],
})
export class AuthModule {}
