import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class TokenRefreshDto {
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString({ message: 'Refresh token must be a string' })
  @MaxLength(255, { message: 'Refresh token cannot exceed 255 characters' })
  refreshToken!: string;
}