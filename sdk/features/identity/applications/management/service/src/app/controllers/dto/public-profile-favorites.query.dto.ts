import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublicProfileFavoritesQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  after?: string;
}
