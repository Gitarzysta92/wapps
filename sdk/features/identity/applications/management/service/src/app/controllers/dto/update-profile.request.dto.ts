import {
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { ProfileSocialLinksDto } from '@domains/customer/profiles';

export class UpdateProfileRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedRevision!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  bio!: string | null;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(120)
  location!: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsObject()
  socialLinks!: ProfileSocialLinksDto;
}
