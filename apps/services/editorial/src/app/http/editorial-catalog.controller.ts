import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  catalogSlug,
  parseCatalogQuery,
  parseCatalogSelectionQuery,
} from '@domains/catalog/record';
import { EditorialCatalog } from '../application/editorial-catalog';

@Controller('catalog')
export class EditorialCatalogController {
  constructor(private readonly catalog: EditorialCatalog) {}

  @Get('application-visibility/:id')
  @Header('Cache-Control', 'no-store')
  async visibility(@Param('id') id: string) {
    const result = await this.catalog.visibility(id);
    if (!result) throw new NotFoundException('Application not found');
    return result;
  }

  @Get('facets')
  @Header('Cache-Control', 'no-store')
  facets() {
    return this.catalog.facets();
  }

  @Get('apps')
  @Header('Cache-Control', 'no-store')
  browse(@Query() query: Record<string, unknown>) {
    return this.catalog.browse(parseCatalogQuery(query));
  }

  @Get('app-selection')
  @Header('Cache-Control', 'no-store')
  select(@Query() query: Record<string, unknown>) {
    return this.catalog.select(parseCatalogSelectionQuery(query));
  }

  @Get('apps/:slug')
  @Header('Cache-Control', 'no-store')
  async find(@Param('slug') slug: string) {
    const app = await this.catalog.find(catalogSlug(slug));
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }
}
