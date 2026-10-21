import { Controller, Get, Header, Query, UseFilters } from '@nestjs/common';
import { DigestService } from './digest.service';
import { ExploreErrorFilter } from './explore.controller';

@Controller('digest')
@UseFilters(ExploreErrorFilter)
export class DigestController {
  constructor(private readonly digest: DigestService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Query() query: unknown) {
    return this.digest.read(query);
  }
}
