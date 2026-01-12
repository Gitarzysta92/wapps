import { ApiProperty } from '@nestjs/swagger';

export class AppRecordResponseDto {
  @ApiProperty({ description: 'App record ID', example: 1 })
  id!: unknown;

  @ApiProperty({ description: 'App slug (URL-friendly identifier)', example: 'my-awesome-app' })
  slug!: string;

  @ApiProperty({ description: 'App name', example: 'My Awesome App' })
  name!: string;

  @ApiProperty({ description: 'App description', example: 'A great application for productivity' })
  description!: string;

  @ApiProperty({ description: 'App logo URL', example: 'https://example.com/logo.png' })
  logo!: string;

  @ApiProperty({ description: 'Whether the app is a PWA', example: true })
  isPwa!: boolean;

  @ApiProperty({ description: 'App rating (0-5)', example: 4.5, minimum: 0, maximum: 5 })
  rating!: number;

  @ApiProperty({ description: 'Array of tag IDs', example: [1, 2, 3], type: [Number] })
  tagIds!: number[];

  @ApiProperty({ description: 'Category ID', example: 5 })
  categoryId!: number;

  @ApiProperty({ description: 'Array of platform IDs', example: [1, 2], type: [Number] })
  platformIds!: number[];

  @ApiProperty({ description: 'Number of reviews', example: 1234 })
  reviewNumber!: number;

  @ApiProperty({ description: 'Last update date', example: '2025-12-30T19:00:00.000Z' })
  updateDate!: Date;

  @ApiProperty({ description: 'Listing date', example: '2025-01-01T00:00:00.000Z' })
  listingDate!: Date;
}

