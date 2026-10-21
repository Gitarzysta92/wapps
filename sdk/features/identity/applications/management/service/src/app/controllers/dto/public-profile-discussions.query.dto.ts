import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class PublicProfileDiscussionsQueryDto {
  @IsOptional()
  @IsString()
  @Length(43, 199)
  @Matches(/^v1\.[A-Za-z0-9_-]{40,196}$/)
  after?: string;
}
