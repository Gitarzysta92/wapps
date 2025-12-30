import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: 'Total number of items', example: 100 })
  total!: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  pageCount!: number;
}

export class PaginatedAppsResponseDto<T> {
  @ApiProperty({ description: 'Array of app records', isArray: true })
  data!: T[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

