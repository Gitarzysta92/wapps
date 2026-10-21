import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  catalogSlug,
  parseCatalogQuery,
  parseCatalogSelectionQuery,
} from '@domains/catalog/record';
import { CatalogService } from './catalog.service';
import { CatalogErrorFilter } from './catalog-error.filter';

@ApiTags('catalog')
@UseFilters(CatalogErrorFilter)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('apps')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Browse public applications using bounded search, facet filters and stable pagination',
  })
  browse(@Query() query: Record<string, unknown>) {
    return this.catalog.browse(parseCatalogQuery(query));
  }

  @Get('app-selection')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Resolve up to 50 canonical application IDs against current public visibility',
  })
  select(@Query() query: Record<string, unknown>) {
    return this.catalog.select(parseCatalogSelectionQuery(query));
  }

  @Get('apps/:slug')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Read a currently public application at its committed revision',
  })
  async find(@Param('slug') slug: string) {
    const app = await this.catalog.find(catalogSlug(slug));
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  @Get('apps/:slug/preview')
  @Header('Cache-Control', 'no-store')
  preview(@Param('slug') slug: string) {
    return this.find(slug);
  }

  @Get('facets')
  @Header('Cache-Control', 'no-store')
  facets() {
    return this.catalog.facets();
  }

  @Get('categories')
  @Header('Cache-Control', 'no-store')
  async categories() {
    return (await this.catalog.facets()).categories;
  }

  @Get('categories/tree')
  @Header('Cache-Control', 'no-store')
  categoryTree() {
    return this.catalog.categoryTree();
  }

  @Get('tags')
  @Header('Cache-Control', 'no-store')
  async tags() {
    return (await this.catalog.facets()).tags;
  }

  @Get('tags/:slug')
  @Header('Cache-Control', 'no-store')
  async tag(@Param('slug') input: string) {
    const slug = catalogSlug(input);
    const tag = (await this.catalog.facets()).tags.find(
      (value) => value.slug === slug
    );
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }
}
