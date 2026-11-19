import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  @IsString()
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
  @MaxLength(200)
  newPassword: string;
}
