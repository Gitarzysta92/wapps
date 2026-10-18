import { IsString, Length, Matches } from 'class-validator';

export class VerifyPasswordResetDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,2048}$/)
  code!: string;
}

export class ResetPasswordDto extends VerifyPasswordResetDto {
  @IsString()
  @Length(6, 128)
  password!: string;

  @IsString()
  @Length(6, 128)
  passwordConfirmation!: string;
}
