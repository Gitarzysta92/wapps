import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignInOAuthDto {
  @IsNotEmpty({ message: 'Provider is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['google', 'github'], { message: 'Provider must be google or github' })
  provider!: string;

  @IsNotEmpty({ message: 'Code is required' })
  @IsString()
  code!: string;

  @IsNotEmpty({ message: 'redirectUri is required' })
  @IsString()
  redirectUri!: string;

  @IsOptional()
  @IsString()
  codeVerifier?: string;
}
