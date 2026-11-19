import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  @IsString({ message: 'Informe a senha atual.' })
  @MaxLength(200, { message: 'Senha muito longa.' })
  currentPassword: string;

  @IsString({ message: 'Informe a nova senha.' })
  @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
  @MaxLength(200, { message: 'A nova senha pode ter no máximo 200 caracteres.' })
  newPassword: string;
}
