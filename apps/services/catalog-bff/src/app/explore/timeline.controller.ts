import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ExploreErrorFilter } from './explore.controller';
import { TimelineService } from './timeline.service';

@Controller('applications/:slug/timeline')
@UseFilters(ExploreErrorFilter)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Param('slug') slug: string, @Query() query: unknown) {
    return this.timeline.read(slug, query);
  }
}
