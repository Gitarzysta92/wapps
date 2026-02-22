import { IsNotEmpty, IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class SignInCredentialsDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  email!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(255, { message: 'Password cannot exceed 255 characters' })
  password!: string;
}