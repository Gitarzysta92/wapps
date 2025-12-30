import { ApiProperty } from '@nestjs/swagger';
import { TagDto } from '@domains/catalog/tags';

export class TagResponseDto implements TagDto {
  @ApiProperty({ description: 'Tag ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Tag slug', example: 'free' })
  slug!: string;

  @ApiProperty({ description: 'Tag name', example: 'Free' })
  name!: string;
}

