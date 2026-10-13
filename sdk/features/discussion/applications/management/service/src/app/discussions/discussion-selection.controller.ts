import { Controller, Get, Header, Query, UseFilters } from '@nestjs/common';
import { PublicDiscussionSelection } from './application/discussion-selection';
import { DiscussionErrorFilter } from './discussion-error.filter';

@Controller('discussion-selection')
@UseFilters(DiscussionErrorFilter)
export class DiscussionSelectionController {
  constructor(private readonly selection: PublicDiscussionSelection) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  select(@Query() query: unknown) {
    return this.selection.select(query);
  }
}
