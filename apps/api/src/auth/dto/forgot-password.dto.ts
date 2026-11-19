import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class ForgotPasswordDto {
  @Transform(email)
  @IsNotEmpty({ message: 'Informe o seu e-mail.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}

export class ResetPasswordWithCodeDto {
  @Transform(email)
  @IsNotEmpty({ message: 'Informe o seu e-mail.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @IsNotEmpty({ message: 'Informe o código recebido por e-mail.' })
  @Matches(/^\d{4,10}$/, { message: 'O código recebido por e-mail tem só números.' })
  code: string;

  @IsNotEmpty({ message: 'Informe a nova senha.' })
  @IsString({ message: 'Informe a nova senha.' })
  @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
  @MaxLength(200, { message: 'A nova senha pode ter no máximo 200 caracteres.' })
  newPassword: string;
}
