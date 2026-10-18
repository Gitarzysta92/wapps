import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  ArrayNotEmpty,
  ArrayMaxSize,
  ArrayUnique,
  Matches,
} from 'class-validator';

export class UnlinkProvidersRequestDto {
  @ApiProperty({ example: ['google.com', 'github.com'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @Matches(/^[a-zA-Z0-9.-]{1,128}$/, { each: true })
  @IsString({ each: true })
  providersToUnlink!: string[];
}
