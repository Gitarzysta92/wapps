import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  parsePublicSuiteQuery,
  parsePublicSuiteSelectionQuery,
  suiteId,
} from '@domains/publication/suite';
import { SuiteCatalog } from './suite-catalog';

@Controller('catalog')
export class SuiteCatalogController {
  constructor(private readonly catalog: SuiteCatalog) {}
  @Get('suites')
  @Header('Cache-Control', 'no-store')
  browse(@Query() query: unknown) {
    return this.catalog.browse(parsePublicSuiteQuery(query));
  }
  @Get('suite-selection')
  @Header('Cache-Control', 'no-store')
  select(@Query() query: unknown) {
    return this.catalog.select(parsePublicSuiteSelectionQuery(query));
  }
  @Get('suites/:id')
  @Header('Cache-Control', 'no-store')
  find(@Param('id') id: string) {
    return this.catalog.find(suiteId(id));
  }
}
