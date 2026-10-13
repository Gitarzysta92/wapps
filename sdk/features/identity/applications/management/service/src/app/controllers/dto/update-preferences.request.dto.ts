import { IsInt, IsObject, Max, Min } from 'class-validator';
import type { CustomerPreferencesDto } from '@domains/customer/preferences';

export class UpdatePreferencesRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedRevision!: number;

  @IsObject()
  preferences!: CustomerPreferencesDto;
}
