import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class UnlinkProvidersRequestDto {
  @ApiProperty({ example: ['google.com', 'github.com'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  providersToUnlink!: string[];
}

