import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class PublicProfileActivityQueryDto {
  @IsOptional()
  @IsString()
  @Length(43, 259)
  @Matches(/^a1\.[A-Za-z0-9_-]{40,256}$/)
  after?: string;
}
