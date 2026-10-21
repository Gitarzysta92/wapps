import { IsEmail, IsString, Length, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, 120)
  @Matches(/^\S(?:[\s\S]*\S)?$/)
  nickname!: string;

  @IsString()
  @Length(6, 128)
  password!: string;

  @IsString()
  @Length(6, 128)
  passwordConfirmation!: string;
}
