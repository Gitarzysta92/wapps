import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { AppRecordResponseDto } from './dto/app-record.dto';
import { AppPreviewResponseDto } from './dto/app-preview.dto';
import { CategoryResponseDto, CategoryTreeResponseDto } from './dto/category.dto';
import { TagResponseDto } from './dto/tag.dto';
import { PaginatedAppsResponseDto } from './dto/paginated-response.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('apps/:slug')
  @ApiOperation({ summary: 'Get app record by slug', description: 'Returns a single app record with all details' })
  @ApiParam({ name: 'slug', description: 'App slug', example: 'my-awesome-app' })
  @ApiResponse({ status: 200, description: 'App record found', type: AppRecordResponseDto })
  @ApiResponse({ status: 404, description: 'App not found' })
  async getAppBySlug(@Param('slug') slug: string): Promise<AppRecordResponseDto> {
    const result = await this.catalogService.getAppRecordResponse(slug);
    if (!result) {
      throw new NotFoundException(`App with slug '${slug}' not found`);
    }
    return result;
  }

  @Get('apps')
  @ApiOperation({ summary: 'List app records', description: 'Returns paginated list of app records with optional filtering' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page', example: 20, type: Number })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category slug', example: 'productivity' })
  @ApiQuery({ name: 'tags', required: false, description: 'Filter by tag slugs (comma-separated)', example: 'free,open-source' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in name and description', example: 'productivity' })
  @ApiResponse({ status: 200, description: 'List of app records', type: PaginatedAppsResponseDto })
  async getApps(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string
  ): Promise<PaginatedAppsResponseDto<AppRecordResponseDto>> {
    return this.catalogService.getAppRecordsResponse({
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      category,
      tags: tags ? tags.split(',') : undefined,
      search,
    });
  }

  @Get('apps/:slug/preview')
  @ApiOperation({ summary: 'Get app preview', description: 'Returns a lightweight preview of an app record' })
  @ApiParam({ name: 'slug', description: 'App slug', example: 'my-awesome-app' })
  @ApiResponse({ status: 200, description: 'App preview found', type: AppPreviewResponseDto })
  @ApiResponse({ status: 404, description: 'App not found' })
  async getAppPreview(@Param('slug') slug: string): Promise<AppPreviewResponseDto> {
    const result = await this.catalogService.getAppPreview(slug);
    if (!result) {
      throw new NotFoundException(`App with slug '${slug}' not found`);
    }
    return result as AppPreviewResponseDto;
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories', description: 'Returns a flat list of all categories' })
  @ApiResponse({ status: 200, description: 'List of categories', type: [CategoryResponseDto] })
  async getCategories(): Promise<CategoryResponseDto[]> {
    return this.catalogService.getCategories() as Promise<CategoryResponseDto[]>;
  }

  @Get('categories/tree')
  @ApiOperation({ summary: 'Get category tree', description: 'Returns categories organized in a tree structure' })
  @ApiResponse({ status: 200, description: 'Category tree', type: [CategoryTreeResponseDto] })
  async getCategoriesTree(): Promise<CategoryTreeResponseDto[]> {
    return this.catalogService.getCategoryTree() as Promise<CategoryTreeResponseDto[]>;
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags', description: 'Returns a list of all tags' })
  @ApiResponse({ status: 200, description: 'List of tags', type: [TagResponseDto] })
  async getTags(): Promise<TagResponseDto[]> {
    return this.catalogService.getTags() as Promise<TagResponseDto[]>;
  }

  @Get('tags/:slug')
  @ApiOperation({ summary: 'Get tag by slug', description: 'Returns a single tag by its slug' })
  @ApiParam({ name: 'slug', description: 'Tag slug', example: 'free' })
  @ApiResponse({ status: 200, description: 'Tag found', type: TagResponseDto })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async getTagBySlug(@Param('slug') slug: string): Promise<TagResponseDto> {
    const result = await this.catalogService.getTag(slug);
    if (!result) {
      throw new NotFoundException(`Tag with slug '${slug}' not found`);
    }
    return result as TagResponseDto;
  }
}

