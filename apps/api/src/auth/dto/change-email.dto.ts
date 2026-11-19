import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RequestEmailChangeDto {
  @Transform(email)
  @IsNotEmpty({ message: 'Informe o novo e-mail.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  newEmail: string;

  @IsNotEmpty({ message: 'Informe a sua senha atual.' })
  @IsString({ message: 'Informe a sua senha atual.' })
  @MaxLength(200, { message: 'Senha muito longa.' })
  currentPassword: string;
}

export class ConfirmEmailChangeDto {
  @Transform(email)
  @IsNotEmpty({ message: 'Informe o novo e-mail.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  newEmail: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @IsNotEmpty({ message: 'Informe o código recebido no novo e-mail.' })
  @Matches(/^\d{4,10}$/, { message: 'O código recebido por e-mail tem só números.' })
  code: string;
}
