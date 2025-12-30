import { ApiProperty } from '@nestjs/swagger';
import { CategoryDto, CategoryTreeDto } from '@domains/catalog/category';

export class CategoryResponseDto implements CategoryDto {
  @ApiProperty({ description: 'Category ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Category name', example: 'Productivity' })
  name!: string;

  @ApiProperty({ description: 'Category slug', example: 'productivity' })
  slug!: string;

  @ApiProperty({ description: 'Parent category ID', example: null, nullable: true })
  parentId!: number | null;

  @ApiProperty({ description: 'Root category ID', example: 1, nullable: true })
  rootId!: number | null;

  @ApiProperty({ description: 'Category depth in tree', example: 0 })
  depth!: number;
}

export class CategoryTreeResponseDto implements CategoryTreeDto {
  @ApiProperty({ description: 'Category ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Category slug', example: 'productivity' })
  slug!: string;

  @ApiProperty({ description: 'Category name', example: 'Productivity' })
  name!: string;

  @ApiProperty({ description: 'Child categories', type: [CategoryTreeResponseDto] })
  childs!: CategoryTreeResponseDto[];
}

