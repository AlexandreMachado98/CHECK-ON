import { jwtSecret, jwtExpiresIn } from '../config/env';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionGuardCache } from './session-guard.cache';

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
  providers: [AuthService, JwtStrategy, SessionGuardCache],
  exports: [AuthService, SessionGuardCache],
})
export class AuthModule {}
