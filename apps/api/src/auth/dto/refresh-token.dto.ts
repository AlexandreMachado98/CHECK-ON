import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o refreshToken.' })
  @MaxLength(512)
  refreshToken: string;
}
