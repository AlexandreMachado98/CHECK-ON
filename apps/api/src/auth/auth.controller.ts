import { BadRequestException, Body, Controller, Get, Post, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AppLoginDto } from './dto/app-login.dto';
import { clientIp } from '../common/client-ip';
import { ForgotPasswordDto, ResetPasswordWithCodeDto } from './dto/forgot-password.dto';
import { PasswordRecoveryService } from './password-recovery.service';
import { EmailChangeService } from './email-change.service';
import { ConfirmEmailChangeDto, RequestEmailChangeDto } from './dto/change-email.dto';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly recovery: PasswordRecoveryService,
    private readonly emailChange: EmailChangeService,
  ) {}

  /** Esqueci minha senha: envia um código para o e-mail (resposta igual exista ou não o e-mail). */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.recovery.requestCode(dto, clientIp(req));
  }

  /** Troca a senha com o código recebido por e-mail. */
  @Post('reset-password-code')
  @HttpCode(HttpStatus.OK)
  resetPasswordWithCode(@Body() dto: ResetPasswordWithCodeDto) {
    return this.recovery.resetWithCode(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, clientIp(req));
  }

  /** Troca do próprio e-mail, passo 1: senha atual + novo e-mail (código vai para o novo e-mail). */
  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  requestEmailChange(@Body() dto: RequestEmailChangeDto, @Req() req: Request) {
    return this.emailChange.request(this.selfId(req), dto);
  }

  /** Troca do próprio e-mail, passo 2: código recebido no novo e-mail. */
  @Post('change-email/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  confirmEmailChange(@Body() dto: ConfirmEmailChangeDto, @Req() req: Request) {
    return this.emailChange.confirm(this.selfId(req), dto);
  }

  /** Dentro de outra empresa ("Acessar empresa"), o super admin não altera o próprio login. */
  private selfId(req: Request): string {
    const user = req.user as { id: string; impersonatedBy?: string | null };
    if (user.impersonatedBy) throw new BadRequestException('Volte à plataforma para alterar o seu acesso.');
    return user.id;
  }

  /** Login do aplicativo: código da empresa + matrícula (sem senha). Token vale só para o app. */
  @Post('app-login')
  @HttpCode(HttpStatus.OK)
  appLogin(@Body() dto: AppLoginDto, @Req() req: Request) {
    return this.authService.appLogin(dto, clientIp(req));
  }

  /** O próprio usuário troca a senha (obrigatório depois de uma senha provisória). */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const user = req.user as { id: string; impersonatedBy?: string | null };
    if (user.impersonatedBy) {
      throw new BadRequestException('Volte à plataforma para alterar a sua senha.');
    }
    return this.authService.changePassword(user.id, dto);
  }

  /** Troca o refresh token por um novo par de tokens. O token enviado deixa de valer. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Encerra a sessão deste aparelho. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return this.authService.me((req.user as { id: string }).id);
  }
}
