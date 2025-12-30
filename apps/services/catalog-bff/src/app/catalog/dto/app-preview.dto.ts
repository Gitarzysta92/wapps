import { ApiProperty } from '@nestjs/swagger';
import { AppPreviewDto } from '@domains/catalog/record';

export class AppPreviewResponseDto implements AppPreviewDto {
  @ApiProperty({ description: 'App preview ID', example: 1 })
  id!: unknown;

  @ApiProperty({ description: 'App slug', example: 'my-awesome-app' })
  slug!: string;

  @ApiProperty({ description: 'App name', example: 'My Awesome App' })
  name!: string;

  @ApiProperty({ description: 'App logo URL', example: 'https://example.com/logo.png' })
  logo!: string;

  @ApiProperty({ description: 'Whether the app is a PWA', example: true })
  isPwa!: boolean;

  @ApiProperty({ description: 'App rating (0-5)', example: 4.5 })
  rating!: number;

  @ApiProperty({ description: 'Number of reviews', example: 1234 })
  reviews!: number;

  @ApiProperty({ description: 'Array of tag IDs', example: [1, 2, 3], type: [Number] })
  tagIds!: number[];

  @ApiProperty({ description: 'Category ID', example: 5 })
  categoryId!: number;

  @ApiProperty({ description: 'Array of platform IDs', example: [1, 2], type: [Number] })
  platformIds!: number[];
}

