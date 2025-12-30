import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('apps/:slug')
  async getAppBySlug(@Param('slug') slug: string) {
    const result = await this.catalogService.getAppRecord(slug);
    if (!result) {
      throw new NotFoundException(`App with slug '${slug}' not found`);
    }
    return result;
  }

  @Get('apps')
  async getApps(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string
  ) {
    return this.catalogService.getAppRecords({
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      category,
      tags: tags ? tags.split(',') : undefined,
      search,
    });
  }

  @Get('apps/:slug/preview')
  async getAppPreview(@Param('slug') slug: string) {
    const result = await this.catalogService.getAppPreview(slug);
    if (!result) {
      throw new NotFoundException(`App with slug '${slug}' not found`);
    }
    return result;
  }

  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('categories/tree')
  async getCategoriesTree() {
    return this.catalogService.getCategoryTree();
  }

  @Get('tags')
  async getTags() {
    return this.catalogService.getTags();
  }

  @Get('tags/:slug')
  async getTagBySlug(@Param('slug') slug: string) {
    const result = await this.catalogService.getTag(slug);
    if (!result) {
      throw new NotFoundException(`Tag with slug '${slug}' not found`);
    }
    return result;
  }
}

