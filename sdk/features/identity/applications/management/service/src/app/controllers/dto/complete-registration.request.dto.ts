import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * Minimal registration completion payload.
 * Add required business fields here over time.
 */
export class CompleteRegistrationRequestDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedRevision!: number;

  @ApiProperty({ example: 'Alice Johnson' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^\S(?:[\s\S]*\S)?$/)
  name!: string;

  @ApiPropertyOptional({ example: 'Builder of things.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'Warsaw, PL' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @MaxLength(2048)
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
    disallow_auth: true,
  })
  avatarUri?: string;
}
