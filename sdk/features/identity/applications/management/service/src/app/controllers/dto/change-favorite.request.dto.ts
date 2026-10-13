import { IsBoolean, IsInt, IsObject, Max, Min } from 'class-validator';
import type { FavoriteTarget } from '@domains/customer/favorites';

export class ChangeFavoriteRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER - 1)
  expectedRevision!: number;

  @IsObject()
  target!: FavoriteTarget;

  @IsBoolean()
  saved!: boolean;
}
