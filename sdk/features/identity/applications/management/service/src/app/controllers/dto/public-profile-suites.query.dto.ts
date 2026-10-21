import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublicProfileSuitesQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(36)
  @MaxLength(36)
  after?: string;
}
